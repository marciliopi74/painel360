-- Motor de cálculo dos Indicadores de Qualidade (requisitos 16-21).
--
-- C1-C7 (eSF/eAP), B1-B6 (eSB) e M1-M2 (eMulti) — os 15 indicadores oficiais do Previne Brasil —
-- estão TODOS implementados com base nas Notas Metodológicas oficiais vigentes (obtidas em
-- saude.gov.br/saps ou fornecidas localmente pelo usuário, em 2026-09-12). Este arquivo traz os
-- helpers comuns e C1; C2-C7 estão em sql/08_indicadores_c2_c7.sql, B1-B6 em
-- sql/09_indicadores_b1_b6.sql, M1-M2 em sql/10_indicadores_m1_m2.sql. Ver
-- docs/indicadores-qualidade.md para simplificações de escopo documentadas em cada um.

-- lê o "modo de cálculo" corrente (ver sql/12_calculo_mensal.sql) — '' (normal, default),
-- 'mensal' (uma calculadora rodando só sobre um mês, dentro de recalcular_indicadores_qualidade)
-- ou 'so_pontuacao' (passada final só pra atualizar boas_praticas_pontuacao_pessoa). Usado por
-- periodo_quadrimestre()/upsert_resultado_indicador()/upsert_resultado_indicador_razao() pra
-- redirecionar o comportamento SEM precisar mudar a assinatura de nenhuma das 17 calculadoras
-- (calcular_c1..c7/b1..b6/m1..m2) nem duplicar a lógica de elegibilidade de cada uma.
CREATE OR REPLACE FUNCTION modo_calculo_atual() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.modo_calculo', true), '');
$$;

-- Nota Técnica nº 6/2025-DEAPS/SAPS/MS, item 4.1: "o resultado do quadrimestre por indicador
-- será obtido pela média dos meses monitorados" — não mais uma janela única de 4 meses. Em modo
-- 'mensal', devolve o mês corrente (setado por recalcular_indicadores_qualidade via
-- set_config) em vez do quadrimestre inteiro — toda calculadora que já chama
-- periodo_quadrimestre() automaticamente passa a operar sobre 1 mês, sem saber disso.
CREATE OR REPLACE FUNCTION periodo_quadrimestre(p_quadrimestre "Quadrimestre", p_ano int)
RETURNS TABLE(inicio date, fim date) LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF modo_calculo_atual() = 'mensal' THEN
    inicio := current_setting('app.calculo_mes_inicio')::date;
    fim := current_setting('app.calculo_mes_fim')::date;
    RETURN NEXT;
    RETURN;
  END IF;

  inicio := CASE p_quadrimestre
    WHEN 'Q1' THEN make_date(p_ano, 1, 1)
    WHEN 'Q2' THEN make_date(p_ano, 5, 1)
    WHEN 'Q3' THEN make_date(p_ano, 9, 1)
  END;
  fim := CASE p_quadrimestre
    WHEN 'Q1' THEN make_date(p_ano, 4, 30)
    WHEN 'Q2' THEN make_date(p_ano, 8, 31)
    WHEN 'Q3' THEN make_date(p_ano, 12, 31)
  END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION classificar_indicador(p_indicador_id uuid, p_valor numeric)
RETURNS "Classificacao" LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v indicadores_catalogo%ROWTYPE;
BEGIN
  SELECT * INTO v FROM indicadores_catalogo WHERE id = p_indicador_id;
  IF v.parametro_otimo_min IS NULL THEN
    RAISE EXCEPTION 'Indicador % ainda não tem parâmetros de banda definidos (preencher a partir da Nota Metodológica)', v.codigo;
  END IF;

  IF v.polaridade = 'maior_melhor' THEN
    RETURN CASE
      WHEN p_valor >= v.parametro_otimo_min THEN 'otimo'
      WHEN p_valor >= v.parametro_bom_min THEN 'bom'
      WHEN p_valor >= v.parametro_suficiente_min THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";
  ELSIF v.polaridade = 'menor_melhor' THEN
    RETURN CASE
      WHEN p_valor <= v.parametro_otimo_max THEN 'otimo'
      WHEN p_valor <= v.parametro_bom_max THEN 'bom'
      WHEN p_valor <= v.parametro_suficiente_max THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";
  ELSE
    -- polaridade neutra: usado por C1/B3/B5 (regular tanto abaixo do mínimo quanto acima do
    -- máximo). Limite inferior EXCLUSIVO / superior INCLUSIVO (ex.: C1 "Ótimo: > 50 e ≤ 70"),
    -- batendo com a notação das Notas Metodológicas oficiais — corrigido em 2026-09-13: a versão
    -- anterior usava BETWEEN (inclusivo nos dois lados), o que classificava um valor bem na
    -- fronteira (ex. exatamente 50% ou 10% no C1) uma faixa acima do que a nota oficial define.
    RETURN CASE
      WHEN p_valor > v.parametro_otimo_min AND p_valor <= v.parametro_otimo_max THEN 'otimo'
      WHEN p_valor > v.parametro_bom_min AND p_valor <= v.parametro_bom_max THEN 'bom'
      WHEN p_valor > v.parametro_suficiente_min AND p_valor <= v.parametro_suficiente_max THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";
  END IF;
END;
$$;

-- Redireciona pra resultados_indicadores_mensal em modo 'mensal' (ver
-- sql/12_calculo_mensal.sql/modo_calculo_atual() acima) — nenhuma das 17 calculadoras que já
-- chamam este procedure precisa saber disso. Em modo 'so_pontuacao' (passada final que só
-- reconstrói boas_praticas_pontuacao_pessoa), não escreve nada aqui de propósito: o resultado
-- quadrimestral já foi gravado por agregar_resultados_mensais() e não pode ser sobrescrito por
-- uma calculadora rodando de novo com a janela cheia só pra atualizar a pontuação por pessoa.
CREATE OR REPLACE PROCEDURE upsert_resultado_indicador(
  p_equipe_id uuid, p_indicador_id uuid, p_quadrimestre "Quadrimestre", p_ano int,
  p_numerador numeric, p_denominador numeric
) LANGUAGE plpgsql AS $$
DECLARE
  v_valor numeric;
  v_modo text := modo_calculo_atual();
BEGIN
  IF v_modo = 'so_pontuacao' THEN RETURN; END IF;

  IF v_modo = 'mensal' THEN
    CALL upsert_resultado_indicador_mensal(
      p_equipe_id, p_indicador_id,
      current_setting('app.calculo_mes_ano')::int, current_setting('app.calculo_mes_numero')::int,
      p_numerador, p_denominador, false
    );
    RETURN;
  END IF;

  v_valor := CASE WHEN p_denominador = 0 THEN 0 ELSE round(100.0 * p_numerador / p_denominador, 2) END;

  INSERT INTO resultados_indicadores
    (id, equipe_id, indicador_id, quadrimestre, ano, numerador, denominador, valor_calculado, classificacao, calculado_em)
  VALUES
    (gen_random_uuid(), p_equipe_id, p_indicador_id, p_quadrimestre, p_ano, p_numerador, p_denominador,
     v_valor, classificar_indicador(p_indicador_id, v_valor), now())
  ON CONFLICT (equipe_id, indicador_id, quadrimestre, ano) DO UPDATE
    SET numerador = EXCLUDED.numerador,
        denominador = EXCLUDED.denominador,
        valor_calculado = EXCLUDED.valor_calculado,
        classificacao = EXCLUDED.classificacao,
        calculado_em = now();
END;
$$;

CREATE OR REPLACE PROCEDURE registrar_pontuacao_pessoa(
  p_equipe_id uuid, p_indicador_id uuid, p_cidadao_cns text, p_criterio_id uuid,
  p_atingiu boolean, p_quadrimestre "Quadrimestre", p_ano int
) LANGUAGE sql AS $$
  INSERT INTO boas_praticas_pontuacao_pessoa
    (id, equipe_id, indicador_id, cidadao_cns, criterio_id, atingiu, quadrimestre, ano)
  VALUES
    (gen_random_uuid(), p_equipe_id, p_indicador_id, p_cidadao_cns, p_criterio_id, p_atingiu, p_quadrimestre, p_ano);
$$;

-- variante usada por calcular_c2..c7: não grava (e não derruba o cálculo do restante da
-- equipe) quando a pessoa não tem CNS resolvido (~8% dos casos reais, ver docs/esus-fdw.md) ou
-- quando o critério ainda não foi semeado em boas_praticas_criterios.
CREATE OR REPLACE PROCEDURE registrar_pontuacao_pessoa_segura(
  p_equipe_id uuid, p_indicador_id uuid, p_cidadao_cns text, p_criterio_id uuid,
  p_atingiu boolean, p_quadrimestre "Quadrimestre", p_ano int
) LANGUAGE plpgsql AS $$
BEGIN
  IF p_cidadao_cns IS NULL OR p_criterio_id IS NULL THEN RETURN; END IF;
  CALL registrar_pontuacao_pessoa(p_equipe_id, p_indicador_id, p_cidadao_cns, p_criterio_id, p_atingiu, p_quadrimestre, p_ano);
END;
$$;

-- requisito 16: filtro de CBO. p_grupos aceita tanto código completo de 6 dígitos sem
-- pontuação ("515105") quanto família de 4 dígitos ("2251", cobre 225125/225142/225170/...),
-- exatamente como as Notas Metodológicas descrevem seus "Grupos de CBO".
CREATE OR REPLACE FUNCTION cbo_no_grupo(p_cbo text, p_grupos text[])
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_cbo IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_grupos) g WHERE left(p_cbo, length(g)) = g
  );
$$;

-- População de referência para C2-C7: cidadãos com vínculo vigente à equipe (requisitos 16-18),
-- via esus.tb_cidadao_vinculacao_equipe (pega a linha mais recente por cidadão) + esus.tb_cidadao
-- para os dados demográficos. Consulta ao vivo via FDW — não é mirrorada localmente (ver
-- docs/esus-fdw.md e docs/indicadores-qualidade.md).
CREATE OR REPLACE FUNCTION cidadaos_vinculados_equipe(p_equipe_id uuid)
RETURNS TABLE(co_cidadao bigint, cns text, dt_nascimento date, no_sexo text, tp_identidade_genero text)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (v.co_cidadao)
    v.co_cidadao, c.nu_cns, c.dt_nascimento, c.no_sexo, c.tp_identidade_genero
  FROM esus.tb_cidadao_vinculacao_equipe v
  JOIN esus.tb_cidadao c ON c.co_seq_cidadao = v.co_cidadao
  JOIN equipes eq ON eq.ine = v.nu_ine
  WHERE eq.id = p_equipe_id
    AND COALESCE(v.st_saida_cadastro_territorio, 0) = 0
    AND COALESCE(v.st_saida_cadastro_obito, 0) = 0
    AND COALESCE(c.st_ativo, 1) = 1
  ORDER BY v.co_cidadao, v.dt_atualizacao_cadastro DESC NULLS LAST;
$$;

-- Condição/problema ativo (CID-10 e/ou CIAP-2) para um cidadão, usado pelos critérios de
-- elegibilidade de C3 (gestação/puerpério), C4 (diabetes) e C5 (hipertensão).
--
-- Bug real corrigido em 2026-09-13 (reportado pelo usuário: atendimentos novos com condição de
-- hipertensão/diabetes registrada não refletiam em C4/C5): `p.co_dim_situacao_problema` é a
-- CHAVE SUBSTITUTA da dimensão (`co_seq_dim_situacao` — 1=Ativo, 2=Latente, 3=Resolvido), não o
-- código de negócio do e-SUS (`nu_identificador` — '0'=Ativo, '1'=Latente, '2'=Resolvido). A
-- versão anterior comparava a chave substituta direto com o código de negócio
-- (`co_dim_situacao_problema = 0`), que nunca é verdadeiro para uma condição realmente Ativa
-- (situação=1) — só "batia" por acidente via COALESCE nas linhas com situação NULA. Corrigido
-- para fazer o join até a dimensão e comparar pelo `nu_identificador`, do mesmo jeito que o
-- resto do schema resolve outras dimensões (ex.: tb_tipo_equipe em sql/03_sync_functions.sql).
CREATE OR REPLACE FUNCTION tem_condicao_ativa(p_co_cidadao bigint, p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM esus.tb_fat_atd_ind_problemas p
    LEFT JOIN esus.tb_cid10 cid ON cid.co_cid10 = p.co_dim_cid
    LEFT JOIN esus.tb_dim_ciap ciap ON ciap.co_seq_dim_ciap = p.co_dim_ciap
    LEFT JOIN esus.tb_dim_situacao_problema sit ON sit.co_seq_dim_situacao = p.co_dim_situacao_problema
    WHERE p.co_fat_cidadao_pec = p_co_cidadao
      AND COALESCE(sit.nu_identificador, '0') = '0' -- 0 = Ativo (tb_dim_situacao_problema.nu_identificador)
      AND ((p_cids IS NOT NULL AND cid.nu_cid10 = ANY(p_cids)) OR (p_ciaps IS NOT NULL AND ciap.nu_ciap = ANY(p_ciaps)))
  );
$$;

-- C1 "Mais Acesso" (Nota Metodológica C1, assinada 24/06/2026): numerador = atendimentos de
-- demanda PROGRAMADA (não espontânea — correção 2026-09-12), denominador = programada +
-- espontânea, ambos restritos aos CBOs da nota e às 5 categorias reais do e-SUS listadas
-- abaixo (as demais, como "Atendimento programado" genérico, não entram no cálculo). Polaridade
-- neutra: Ótimo entre 50-70%, Regular tanto ≤10% quanto >70% (ver sql/07_seed_indicadores.sql).
CREATE OR REPLACE PROCEDURE calcular_c1(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['225142','225170','225130','225125','225250','223565','223505'];
  r record;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C1';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN
    SELECT eq.id AS equipe_id,
           count(*) FILTER (
             WHERE a.tipo_atendimento IN ('Consulta agendada programada / Cuidado continuado', 'Consulta agendada')
           ) AS programada,
           count(*) AS total
    FROM equipes eq
    JOIN atendimentos a ON a.equipe_id = eq.id
                        AND a.data_atendimento BETWEEN v_inicio AND v_fim
                        AND cbo_no_grupo(a.cbo, v_cbo)
                        AND a.tipo_atendimento IN (
                          'Consulta agendada programada / Cuidado continuado', 'Consulta agendada',
                          'Escuta inicial / Orientação', 'Consulta no dia', 'Atendimento de urgência'
                        )
    WHERE eq.tipo IN ('ESF', 'EAP') -- eSF tipo 70 / eAP tipo 76 — schema não distingue, ver docs/indicadores-qualidade.md
    GROUP BY eq.id
  LOOP
    CALL upsert_resultado_indicador(r.equipe_id, v_indicador_id, p_quadrimestre, p_ano, r.programada, r.total);
  END LOOP;
END;
$$;

-- eSB (B1-B6) e eMulti (M1-M2): implementadas de verdade em sql/09_indicadores_b1_b6.sql e
-- sql/10_indicadores_m1_m2.sql, a partir das Notas Metodológicas oficiais (fornecidas
-- localmente pelo usuário em 2026-09-12). Nenhum stub aqui — 09/10 rodam logo após este
-- arquivo (ordem alfabética em scripts/apply-sql.ts) e definem calcular_b1..calcular_m2 antes
-- de qualquer CALL real acontecer.

-- Cada calculadora roda isolada: se uma falhar (ex.: indicador sem bandas de classificação
-- ainda cadastradas — ver sql/07_seed_indicadores.sql), as demais continuam normalmente.
-- calcular_c2..c7, calcular_b1..b6 e calcular_m1..m2 são definidas em
-- sql/08_indicadores_c2_c7.sql, sql/09_indicadores_b1_b6.sql e sql/10_indicadores_m1_m2.sql
-- respectivamente (CREATE OR REPLACE — a lista abaixo já referencia os nomes finais).
-- Nota Técnica nº 6/2025-DEAPS/SAPS/MS, item 4.1: o resultado quadrimestral de cada indicador
-- é a MÉDIA dos resultados mensais monitorados, não mais um cálculo direto sobre a janela dos 4
-- meses inteira (bug de metodologia real corrigido em 2026-09-13 — o comportamento antigo
-- ainda existe e continua correto para quem chamar as calculadoras diretamente, ver
-- modo_calculo_atual() acima). Fluxo:
--   1) roda as 17 calculadoras 1x por mês (modo 'mensal' — cada uma grava em
--      resultados_indicadores_mensal via upsert_resultado_indicador[_razao] redirecionado, sem
--      mudar nada da lógica de elegibilidade de cada calculadora);
--   2) agrega os meses em resultados_indicadores (média simples dos meses com denominador>0 —
--      isso já aplica de graça a regra especial do item 4.1.1 pra C2/C3 "só conta mês com
--      coorte de fechamento", porque toda calculadora já só grava um mês quando population
--      elegível > 0);
--   3) passada final (modo 'so_pontuacao', só C2-C7) pra reconstruir
--      boas_praticas_pontuacao_pessoa com a janela cheia do quadrimestre — sem sobrescrever o
--      resultado médio calculado no passo 2 (upsert_resultado_indicador não escreve nada nesse
--      modo, ver comentário lá).
CREATE OR REPLACE PROCEDURE recalcular_indicadores_qualidade(p_quadrimestre "Quadrimestre", p_ano int)
LANGUAGE plpgsql AS $$
DECLARE
  v_proc text;
  v_mes record;
BEGIN
  FOR v_mes IN SELECT * FROM meses_do_quadrimestre(p_quadrimestre, p_ano) LOOP
    PERFORM set_config('app.modo_calculo', 'mensal', true);
    PERFORM set_config('app.calculo_mes_inicio', v_mes.inicio::text, true);
    PERFORM set_config('app.calculo_mes_fim', v_mes.fim::text, true);
    PERFORM set_config('app.calculo_mes_ano', v_mes.ano::text, true);
    PERFORM set_config('app.calculo_mes_numero', v_mes.mes::text, true);

    FOREACH v_proc IN ARRAY ARRAY[
      'calcular_c1', 'calcular_c2', 'calcular_c3', 'calcular_c4', 'calcular_c5', 'calcular_c6', 'calcular_c7',
      'calcular_b1', 'calcular_b2', 'calcular_b3', 'calcular_b4', 'calcular_b5', 'calcular_b6',
      'calcular_m1', 'calcular_m2'
    ]
    LOOP
      BEGIN
        EXECUTE format('CALL %I($1, $2)', v_proc) USING p_quadrimestre, p_ano;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'recalcular_indicadores_qualidade: falha em % (mês %/%) — %', v_proc, v_mes.mes, v_mes.ano, SQLERRM;
      END;
    END LOOP;
  END LOOP;

  PERFORM set_config('app.modo_calculo', '', true);
  CALL agregar_resultados_mensais(p_quadrimestre, p_ano);

  PERFORM set_config('app.modo_calculo', 'so_pontuacao', true);
  FOREACH v_proc IN ARRAY ARRAY['calcular_c2', 'calcular_c3', 'calcular_c4', 'calcular_c5', 'calcular_c6', 'calcular_c7'] LOOP
    BEGIN
      EXECUTE format('CALL %I($1, $2)', v_proc) USING p_quadrimestre, p_ano;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalcular_indicadores_qualidade: falha na passada de pontuação em % — %', v_proc, SQLERRM;
    END;
  END LOOP;
  PERFORM set_config('app.modo_calculo', '', true);
END;
$$;
