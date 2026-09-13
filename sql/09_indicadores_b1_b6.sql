-- B1-B6 (eSB) — requisitos 17, 19-21.
--
-- Fonte: Notas Metodológicas oficiais B1-B6 (Ministério da Saúde/SAPS, assinadas
-- eletronicamente em 12-13/05/2026), fornecidas localmente pelo usuário em 2026-09-12. Códigos
-- CBO/SIGTAP e bandas em sql/07b_seed_indicadores_b1_b6.sql vêm literalmente dessas notas.
--
-- PARTICULARIDADES REAIS DESTAS NOTAS (não erros — conferido com o texto oficial):
--  1. B1 e B4 são RAZÕES BRUTAS (podem passar de 1,0/100%), não percentuais 0-100 — o
--     numerador conta pessoas atendidas independente de vinculação, mas o denominador só conta
--     vinculadas à eSF/eAP de referência, então a razão pode legitimamente exceder 1. Usam
--     upsert_resultado_indicador_razao (sem multiplicar por 100) e bandas tipo "Ótimo: > 1,25".
--  2. B3 e B5, apesar de rotuladas "polaridade: menor-melhor"/"maior-melhor" na nota, têm
--     bandas com Regular nas DUAS pontas (ex. B3: Regular se <3 OU ≥14) — tratadas como
--     'neutra' no catálogo para classificar corretamente (mesmo padrão de C1).
--  3. Regra de vinculação eSB↔eSF/eAP por carga horária (2 eSB 20h dividem a população de 1 eSF
--     40h) depende de equipes.carga_horaria_semanal, que não vem do e-SUS — precisa ser
--     preenchida manualmente pelo coordenador (junto com equipe_referencia_id) na tela de
--     equipes. Sem isso, o divisor default é 1 (sem divisão).
--  4. B1/B2 simplificam a regra "contabilizado 1x por dentista a cada 12 meses" para "contagem
--     de pessoas distintas com o evento no quadrimestre", sem rastrear a janela de 12 meses por
--     par pessoa+dentista (mesma classe de simplificação já documentada para C2-C7).

-- ===================== helpers =====================

-- valor_calculado = numerador/denominador SEM multiplicar por 100 (B1, B4 — ver nota 1 acima).
-- Mesmo redirecionamento de modo_calculo_atual() que upsert_resultado_indicador() tem, em
-- sql/04_indicadores_motor_calculo.sql — ver comentário lá para o porquê.
CREATE OR REPLACE PROCEDURE upsert_resultado_indicador_razao(
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
      p_numerador, p_denominador, true
    );
    RETURN;
  END IF;

  v_valor := CASE WHEN p_denominador = 0 THEN 0 ELSE round(p_numerador / p_denominador, 4) END;

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

-- divisor da população vinculada quando 2 eSB de 20h dividem 1 eSF de 40h (ver nota 3 acima).
CREATE OR REPLACE FUNCTION divisor_vinculacao_esb(p_esb_id uuid) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN esb.carga_horaria_semanal = 20 AND ref.tipo = 'ESF' THEN 2 ELSE 1 END
  FROM equipes esb
  LEFT JOIN equipes ref ON ref.id = esb.equipe_referencia_id
  WHERE esb.id = p_esb_id;
$$;

-- conta procedimentos odontológicos (tb_fat_atend_odonto_proced) de uma eSB (por INE) com CBO
-- e código SIGTAP elegíveis numa janela — usado por B3/B5/B6 (contam procedimentos, não pessoas).
CREATE OR REPLACE FUNCTION contar_procedimentos_odonto(p_ine text, p_cbo text[], p_codigos text[], p_desde date, p_ate date)
RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT count(*)
  FROM esus.tb_fat_atend_odonto_proced pr
  JOIN esus.tb_dim_procedimento dp ON dp.co_seq_dim_procedimento = pr.co_dim_procedimento
  JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = pr.co_dim_equipe_1
  WHERE dim_eq.nu_ine = p_ine
    AND pr.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
    AND cbo_no_grupo(nu_cbo_de(pr.co_dim_cbo_1), p_cbo)
    AND dp.co_proced = ANY(p_codigos);
$$;

-- ===================== B1: Primeira consulta programada =====================
CREATE OR REPLACE PROCEDURE calcular_b1(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272'];
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B1';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN
    SELECT id, ine, equipe_referencia_id FROM equipes
    WHERE tipo = 'ESB' AND ativo AND equipe_referencia_id IS NOT NULL AND ine IS NOT NULL
  LOOP
    SELECT count(DISTINCT o.co_fat_cidadao_pec) INTO v_num
    FROM esus.tb_fat_atendimento_odonto o
    JOIN esus.tb_dim_tipo_consulta_odonto tc ON tc.co_seq_dim_tipo_cnsulta_odonto = o.co_dim_tipo_consulta
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = o.co_dim_equipe_1
    WHERE dim_eq.nu_ine = r.ine
      AND o.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(o.co_dim_cbo_1), v_cbo)
      AND tc.ds_tipo_consulta_odonto ILIKE '%primeira consulta%program%';

    SELECT count(*) INTO v_den FROM cidadaos_vinculados_equipe(r.equipe_referencia_id);
    v_den := v_den / divisor_vinculacao_esb(r.id);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador_razao(r.id, v_indicador_id, p_quadrimestre, p_ano, coalesce(v_num, 0), v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== B2: Tratamento concluído =====================
CREATE OR REPLACE PROCEDURE calcular_b2(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272'];
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B2';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'ESB' AND ativo AND ine IS NOT NULL LOOP
    SELECT
      count(DISTINCT o.co_fat_cidadao_pec) FILTER (WHERE coalesce(o.st_conduta_tratamento_concluid, 0) = 1),
      count(DISTINCT o.co_fat_cidadao_pec) FILTER (WHERE tc.ds_tipo_consulta_odonto ILIKE '%primeira consulta%program%')
      INTO v_num, v_den
    FROM esus.tb_fat_atendimento_odonto o
    LEFT JOIN esus.tb_dim_tipo_consulta_odonto tc ON tc.co_seq_dim_tipo_cnsulta_odonto = o.co_dim_tipo_consulta
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = o.co_dim_equipe_1
    WHERE dim_eq.nu_ine = r.ine
      AND o.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(o.co_dim_cbo_1), v_cbo);

    IF coalesce(v_den, 0) > 0 THEN
      CALL upsert_resultado_indicador(r.id, v_indicador_id, p_quadrimestre, p_ano, coalesce(v_num, 0), v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== B3: Taxa de exodontia =====================
CREATE OR REPLACE PROCEDURE calcular_b3(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272', '322405', '322425'];
  v_codigos_exodontia text[] := ARRAY['0414020138', '0414020146'];
  v_codigos_total text[] := ARRAY[
    '0101020058','0101020066','0101020074','0101020082','0101020090','0101020120',
    '0307010015','0307010031','0307010066','0307010074','0307010082','0307010104','0307010112','0307010120',
    '0307020010','0307020029',
    '0307030024','0307030040','0307030059','0307030067','0307030075','0307030083',
    '0307050017','0414020138','0414020146'
  ];
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B3';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'ESB' AND ativo AND ine IS NOT NULL LOOP
    v_num := contar_procedimentos_odonto(r.ine, v_cbo, v_codigos_exodontia, v_inicio, v_fim);
    v_den := contar_procedimentos_odonto(r.ine, v_cbo, v_codigos_total, v_inicio, v_fim);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador(r.id, v_indicador_id, p_quadrimestre, p_ano, v_num, v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== B4: Escovação supervisionada =====================
CREATE OR REPLACE PROCEDURE calcular_b4(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272', '322405', '322425', '322415', '322430'];
  v_codigo_procedimento text := '0101020031'; -- 01.01.02.003-1 Ação coletiva de escovação dental supervisionada
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B4';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN
    SELECT id, ine, equipe_referencia_id FROM equipes
    WHERE tipo = 'ESB' AND ativo AND equipe_referencia_id IS NOT NULL AND ine IS NOT NULL
  LOOP
    SELECT count(DISTINCT part.co_fat_cidadao_pec) INTO v_num
    FROM esus.tb_fat_atvdd_coletiva_part part
    JOIN esus.tb_fat_atividade_coletiva ativ ON ativ.co_seq_fat_atividade_coletiva = part.co_fat_atividade_coletiva
    LEFT JOIN esus.tb_dim_procedimento dp ON dp.co_seq_dim_procedimento = ativ.co_dim_procedimento
    JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = part.co_dim_equipe
    WHERE dim_eq.nu_ine = r.ine
      AND t.dt_registro BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(part.co_dim_cbo), v_cbo)
      AND (dp.co_proced = v_codigo_procedimento OR ativ.ds_filtro_pratica_em_saude ILIKE '%escova%supervision%')
      AND part.dt_participante_nascimento IS NOT NULL
      AND extract(year FROM age(v_fim, part.dt_participante_nascimento)) BETWEEN 6 AND 12;

    SELECT count(*) INTO v_den
    FROM cidadaos_vinculados_equipe(r.equipe_referencia_id)
    WHERE dt_nascimento IS NOT NULL AND extract(year FROM age(v_fim, dt_nascimento)) BETWEEN 6 AND 12;
    v_den := v_den / divisor_vinculacao_esb(r.id);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador_razao(r.id, v_indicador_id, p_quadrimestre, p_ano, coalesce(v_num, 0), v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== B5: Procedimentos odontológicos preventivos =====================
CREATE OR REPLACE PROCEDURE calcular_b5(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272', '322405', '322425'];
  v_codigos_preventivos text[] := ARRAY['0101020058','0101020066','0101020074','0101020082','0101020104','0101020120','0307030040'];
  v_codigos_total text[] := ARRAY[
    '0101020058','0101020066','0101020074','0101020082','0101020090','0101020104','0101020120',
    '0414020138',
    '0307010015','0307010031','0307010066','0307010074','0307010082','0307010104','0307010112','0307010120','0307010147','0307010155',
    '0307020010','0307020029','0307020070',
    '0307030024','0307030040','0307030059','0307030067','0307030075','0307030083','0307050017'
  ];
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B5';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'ESB' AND ativo AND ine IS NOT NULL LOOP
    v_num := contar_procedimentos_odonto(r.ine, v_cbo, v_codigos_preventivos, v_inicio, v_fim);
    v_den := contar_procedimentos_odonto(r.ine, v_cbo, v_codigos_total, v_inicio, v_fim);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador(r.id, v_indicador_id, p_quadrimestre, p_ano, v_num, v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== B6: Tratamento Restaurador Atraumático (ART) =====================
CREATE OR REPLACE PROCEDURE calcular_b6(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := ARRAY['223208', '223293', '223272'];
  v_codigo_art text[] := ARRAY['0307010074'];
  v_codigos_restauradores text[] := ARRAY['0307010074','0307010031','0307010082','0307010104','0307010112','0307010120'];
  r record;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'B6';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'ESB' AND ativo AND ine IS NOT NULL LOOP
    v_num := contar_procedimentos_odonto(r.ine, v_cbo, v_codigo_art, v_inicio, v_fim);
    v_den := contar_procedimentos_odonto(r.ine, v_cbo, v_codigos_restauradores, v_inicio, v_fim);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador(r.id, v_indicador_id, p_quadrimestre, p_ano, v_num, v_den);
    END IF;
  END LOOP;
END;
$$;
