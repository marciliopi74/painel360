-- Motor de cálculo dos Indicadores de Qualidade (requisitos 16-21).
--
-- C1-C7 (eSF/eAP), B1-B6 (eSB) e M1-M2 (eMulti) — os 15 indicadores oficiais do Previne Brasil —
-- estão TODOS implementados com base nas Notas Metodológicas oficiais vigentes (obtidas em
-- saude.gov.br/saps ou fornecidas localmente pelo usuário, em 2026-09-12). Este arquivo traz os
-- helpers comuns e C1; C2-C7 estão em sql/08_indicadores_c2_c7.sql, B1-B6 em
-- sql/09_indicadores_b1_b6.sql, M1-M2 em sql/10_indicadores_m1_m2.sql. Ver
-- docs/indicadores-qualidade.md para simplificações de escopo documentadas em cada um.

CREATE OR REPLACE FUNCTION periodo_quadrimestre(p_quadrimestre "Quadrimestre", p_ano int)
RETURNS TABLE(inicio date, fim date) LANGUAGE sql IMMUTABLE AS $$
  SELECT
    CASE p_quadrimestre
      WHEN 'Q1' THEN make_date(p_ano, 1, 1)
      WHEN 'Q2' THEN make_date(p_ano, 5, 1)
      WHEN 'Q3' THEN make_date(p_ano, 9, 1)
    END,
    CASE p_quadrimestre
      WHEN 'Q1' THEN make_date(p_ano, 4, 30)
      WHEN 'Q2' THEN make_date(p_ano, 8, 31)
      WHEN 'Q3' THEN make_date(p_ano, 12, 31)
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
    -- polaridade neutra: usado por C1 (regular tanto abaixo do mínimo quanto acima do máximo).
    RETURN CASE
      WHEN p_valor BETWEEN v.parametro_otimo_min AND v.parametro_otimo_max THEN 'otimo'
      WHEN p_valor BETWEEN v.parametro_bom_min AND v.parametro_bom_max THEN 'bom'
      WHEN p_valor BETWEEN v.parametro_suficiente_min AND v.parametro_suficiente_max THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE upsert_resultado_indicador(
  p_equipe_id uuid, p_indicador_id uuid, p_quadrimestre "Quadrimestre", p_ano int,
  p_numerador numeric, p_denominador numeric
) LANGUAGE plpgsql AS $$
DECLARE
  v_valor numeric;
BEGIN
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
CREATE OR REPLACE FUNCTION tem_condicao_ativa(p_co_cidadao bigint, p_cids text[], p_ciaps text[])
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM esus.tb_fat_atd_ind_problemas p
    LEFT JOIN esus.tb_cid10 cid ON cid.co_cid10 = p.co_dim_cid
    LEFT JOIN esus.tb_dim_ciap ciap ON ciap.co_seq_dim_ciap = p.co_dim_ciap
    WHERE p.co_fat_cidadao_pec = p_co_cidadao
      AND COALESCE(p.co_dim_situacao_problema, 0) = 0 -- 0 = Ativo (tb_dim_situacao_problema)
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
CREATE OR REPLACE PROCEDURE recalcular_indicadores_qualidade(p_quadrimestre "Quadrimestre", p_ano int)
LANGUAGE plpgsql AS $$
DECLARE
  v_proc text;
BEGIN
  FOREACH v_proc IN ARRAY ARRAY[
    'calcular_c1', 'calcular_c2', 'calcular_c3', 'calcular_c4', 'calcular_c5', 'calcular_c6', 'calcular_c7',
    'calcular_b1', 'calcular_b2', 'calcular_b3', 'calcular_b4', 'calcular_b5', 'calcular_b6',
    'calcular_m1', 'calcular_m2'
  ]
  LOOP
    BEGIN
      EXECUTE format('CALL %I($1, $2)', v_proc) USING p_quadrimestre, p_ano;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'recalcular_indicadores_qualidade: falha em % — %', v_proc, SQLERRM;
    END;
  END LOOP;
END;
$$;
