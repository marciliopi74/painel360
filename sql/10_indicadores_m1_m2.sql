-- M1-M2 (eMulti) — requisito 18 (indicadores de qualidade eMulti).
--
-- Fonte: Notas Metodológicas oficiais M1 (Nota Técnica nº 43/2026-CGIAD) e M2 (nº 44/2026-CGIAD),
-- fornecidas localmente pelo usuário em 2026-09-12. Ambas assinadas eletronicamente em
-- 10-12/06/2026.
--
-- M1: implementação fiel (numerador/denominador batem 1:1 com a nota).
--
-- M2: PARCIALMENTE implementado — mesma limitação já registrada na versão anterior deste
-- projeto (ver memória "indicadores_qualidade_motor_calculo"): detectar "ação compartilhada"
-- exige um campo de profissional SECUNDÁRIO por ação. Isso existe em
-- tb_fat_atendimento_individual (co_dim_profissional_2/co_dim_cbo_2) mas NÃO existe em
-- tb_fat_atvdd_coletiva_part/tb_fat_atividade_coletiva (só um profissional por registro) —
-- não há como saber, só com essas tabelas, se uma atividade coletiva foi conduzida por 2+
-- profissionais simultaneamente. Por isso:
--   - Numerador conta: (a) atendimentos individuais com profissional_2 preenchido e
--     cbo_1 OU cbo_2 elegível para eMulti; (b) todo registro em
--     tb_fat_cuidado_compartilhado (Módulo Compartilhamento do Cuidado do PEC) com CBO de
--     evolução elegível — que por definição já É uma ação compartilhada.
--   - Atividades coletivas compartilhadas NÃO entram no numerador (gap real, documentado).
--   - Denominador conta todas as ações da eMulti (individuais + coletivas + cuidado
--     compartilhado), então o indicador tende a SUBESTIMAR o percentual real (undercount só no
--     numerador). Ver docs/indicadores-qualidade.md.

-- CBO eMulti (Nota M1/M2, alínea "c") — usado por M1 e M2.
CREATE OR REPLACE FUNCTION cbo_emulti() RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    '515305','251605','223445','223405','223605','223810',
    '225105','225120','225125','225135','225155','225180','225250','225195','225103','225124','225133',
    '223305','223505','223580','223545','223555',
    '223710','224140','251510','131225','223905'
  ];
$$;

-- ===================== M1: Média de atendimentos por pessoa =====================
-- valor = razão bruta (média), não percentual — usa upsert_resultado_indicador_razao (ver
-- sql/09_indicadores_b1_b6.sql, mesma variante já criada para B1/B4).
CREATE OR REPLACE PROCEDURE calcular_m1(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := cbo_emulti();
  r record;
  v_atend_ind bigint; v_atend_colet bigint;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'M1';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'EMULTI' AND ativo AND ine IS NOT NULL LOOP
    SELECT count(*) INTO v_atend_ind
    FROM esus.tb_fat_atendimento_individual f
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
    WHERE dim_eq.nu_ine = r.ine
      AND f.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), v_cbo);

    SELECT count(*) INTO v_atend_colet
    FROM esus.tb_fat_atvdd_coletiva_part part
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = part.co_dim_equipe
    JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
    WHERE dim_eq.nu_ine = r.ine
      AND t.dt_registro BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(part.co_dim_cbo), v_cbo);

    v_num := coalesce(v_atend_ind, 0) + coalesce(v_atend_colet, 0);

    SELECT count(DISTINCT cid) INTO v_den FROM (
      SELECT f.co_fat_cidadao_pec AS cid
      FROM esus.tb_fat_atendimento_individual f
      JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
      WHERE dim_eq.nu_ine = r.ine
        AND f.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
        AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), v_cbo)
      UNION
      SELECT part.co_fat_cidadao_pec
      FROM esus.tb_fat_atvdd_coletiva_part part
      JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = part.co_dim_equipe
      JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
      WHERE dim_eq.nu_ine = r.ine
        AND t.dt_registro BETWEEN v_inicio AND v_fim
        AND cbo_no_grupo(nu_cbo_de(part.co_dim_cbo), v_cbo)
    ) u;

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador_razao(r.id, v_indicador_id, p_quadrimestre, p_ano, v_num, v_den);
    END IF;
  END LOOP;
END;
$$;

-- ===================== M2: Ações interprofissionais =====================
CREATE OR REPLACE PROCEDURE calcular_m2(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo text[] := cbo_emulti();
  r record;
  v_atend_compartilhado bigint;
  v_cuidado_compartilhado bigint;
  v_atend_total bigint;
  v_colet_total bigint;
  v_cuidado_total bigint;
  v_num numeric; v_den numeric;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'M2';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, ine FROM equipes WHERE tipo = 'EMULTI' AND ativo AND ine IS NOT NULL LOOP
    -- numerador (a): atendimentos individuais com 2º profissional registrado e pelo menos um
    -- dos dois (principal ou secundário) com CBO eMulti.
    SELECT count(*) INTO v_atend_compartilhado
    FROM esus.tb_fat_atendimento_individual f
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
    WHERE dim_eq.nu_ine = r.ine
      AND f.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
      AND f.co_dim_profissional_2 IS NOT NULL
      AND (cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), v_cbo) OR cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_2), v_cbo));

    -- numerador (b): Módulo Compartilhamento do Cuidado do PEC — por definição já é
    -- compartilhado (é uma resposta da eMulti a uma solicitação de outro profissional).
    SELECT count(*) INTO v_cuidado_compartilhado
    FROM esus.tb_fat_cuidado_compartilhado cc
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = cc.co_dim_equipe_evolucao
    WHERE dim_eq.nu_ine = r.ine
      AND cc.dt_evolucao::date BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(cc.co_dim_cbo_evolucao), v_cbo);

    -- denominador: todas as ações da eMulti no período (individuais + coletivas + cuidado
    -- compartilhado), compartilhadas ou não.
    SELECT count(*) INTO v_atend_total
    FROM esus.tb_fat_atendimento_individual f
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
    WHERE dim_eq.nu_ine = r.ine
      AND f.dt_inicial_atendimento::date BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), v_cbo);

    SELECT count(DISTINCT ativ.co_seq_fat_atividade_coletiva) INTO v_colet_total
    FROM esus.tb_fat_atividade_coletiva ativ
    JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = ativ.co_dim_equipe
    JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = ativ.co_dim_tempo
    WHERE dim_eq.nu_ine = r.ine
      AND t.dt_registro BETWEEN v_inicio AND v_fim
      AND cbo_no_grupo(nu_cbo_de(ativ.co_dim_cbo), v_cbo);

    v_cuidado_total := v_cuidado_compartilhado; -- toda linha de cuidado compartilhado já conta como ação

    v_num := coalesce(v_atend_compartilhado, 0) + coalesce(v_cuidado_compartilhado, 0);
    v_den := coalesce(v_atend_total, 0) + coalesce(v_colet_total, 0) + coalesce(v_cuidado_total, 0);

    IF v_den > 0 THEN
      CALL upsert_resultado_indicador(r.id, v_indicador_id, p_quadrimestre, p_ano, v_num, v_den);
    END IF;
  END LOOP;
END;
$$;
