-- C2-C7 (Cuidado no desenvolvimento infantil / gestação e puerpério / diabetes / hipertensão /
-- pessoa idosa / mulher na prevenção do câncer) — requisitos 16, 19-21.
--
-- Fonte: Notas Metodológicas oficiais (Ministério da Saúde/SAPS, saude.gov.br/saps, obtidas e
-- lidas integralmente em 2026-09-12; documentos assinados eletronicamente em jun/2026). Os
-- códigos CBO/SIGTAP/CID-10/CIAP-2/vacina e os pontos de cada critério em
-- sql/07_seed_indicadores.sql vêm literalmente dessas notas.
--
-- SIMPLIFICAÇÕES DE ESCOPO conscientes (documentadas, não esquecidas — ver
-- docs/indicadores-qualidade.md para o detalhe completo):
--  1. Cada boa prática usa só as fontes de registro MAIS COMUNS de cada Nota — Atendimento
--     Individual (MIAI), Procedimentos (MIP), Visita Domiciliar (MIVDT) e Vacinação (MIV). A
--     fonte "Atividade Coletiva" (MIAC), citada como alternativa em várias boas práticas, não
--     foi implementada — registros feitos só por atividade coletiva (não também por
--     atendimento individual/procedimento) não contam.
--  2. Os "códigos rápidos ABP/ABEX" citados como via alternativa de registro (ex.: ABP022 para
--     rastreamento de colo do útero, ABEX008 para hemoglobina glicada) não foram implementados
--     — dependem de um campo/tabela de "registro rápido" ainda não localizado no data warehouse
--     desta instalação. Só os códigos SIGTAP/CID-10/CIAP-2 completos contam.
--  3. C3: em vez de calcular as janelas exatas de 294 dias de gestação / 42 dias de puerpério a
--     partir da DUM (que exigiria tb_pre_natal/tb_fat_rel_op_gestante, não explorados nesta
--     sessão), uma pessoa é considerada gestante/puérpera enquanto sua condição CID-10/CIAP-2
--     correspondente estiver marcada como "ativa" no e-SUS (situação que o próprio e-SUS já
--     mantém). Pode divergir ligeiramente do cálculo oficial em casos de atualização tardia do
--     desfecho da gestação no prontuário.
--  4. Esquemas de múltiplas doses de vacina (C2 boa prática E) contam doses de cada família
--     (pentavalente, VIP, SCR, pneumocócica) sem validar o intervalo mínimo de 30 dias entre
--     doses nem a exclusão de doses de SCR antes dos 12 meses de vida.
--  5. eSF/eAP tipo 70/76 não são distinguíveis no schema atual — todas as equipes ESF/EAP
--     entram no cálculo (ver docs/indicadores-qualidade.md, gap já documentado desde C1).

-- ===================== helpers genéricos =====================

CREATE OR REPLACE FUNCTION nu_cbo_de(p_co_dim_cbo bigint) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nu_cbo FROM esus.tb_dim_cbo WHERE co_seq_dim_cbo = p_co_dim_cbo;
$$;

-- conta dias distintos com atendimento individual (MIAI) por CBO elegível numa janela
CREATE OR REPLACE FUNCTION contar_atendimentos(p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT f.dt_inicial_atendimento::date)
  FROM esus.tb_fat_atendimento_individual f
  WHERE f.co_fat_cidadao_pec = p_co_cidadao
    AND f.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
    AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), p_cbo);
$$;

-- peso+altura no mesmo dia: campo direto do MIAI OU procedimento SIGTAP (MIP)
CREATE OR REPLACE FUNCTION contar_peso_altura(p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT dia) FROM (
    SELECT f.dt_inicial_atendimento::date AS dia
    FROM esus.tb_fat_atendimento_individual f
    WHERE f.co_fat_cidadao_pec = p_co_cidadao
      AND f.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND f.nu_peso IS NOT NULL AND f.nu_altura IS NOT NULL
      AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), p_cbo)
    UNION
    SELECT pr.dt_inicial_atendimento::date
    FROM esus.tb_fat_atd_ind_procedimentos pr
    JOIN esus.tb_dim_procedimento dp
      ON dp.co_seq_dim_procedimento IN (pr.co_dim_procedimento_avaliado, pr.co_dim_procedimento_solicitado)
    WHERE pr.co_fat_cidadao_pec = p_co_cidadao
      AND pr.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND dp.co_proced IN ('0101040024', '0101040083', '0101040075')
      AND cbo_no_grupo(nu_cbo_de(pr.co_dim_cbo_1), p_cbo)
  ) t;
$$;

-- aferição de pressão arterial: campo direto do MIAI OU procedimento SIGTAP 03.01.10.003-9
CREATE OR REPLACE FUNCTION contar_pressao(p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT dia) FROM (
    SELECT f.dt_inicial_atendimento::date AS dia
    FROM esus.tb_fat_atendimento_individual f
    WHERE f.co_fat_cidadao_pec = p_co_cidadao
      AND f.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND f.nu_pressao_sistolica IS NOT NULL AND f.nu_pressao_diastolica IS NOT NULL
      AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), p_cbo)
    UNION
    SELECT pr.dt_inicial_atendimento::date
    FROM esus.tb_fat_atd_ind_procedimentos pr
    JOIN esus.tb_dim_procedimento dp
      ON dp.co_seq_dim_procedimento IN (pr.co_dim_procedimento_avaliado, pr.co_dim_procedimento_solicitado)
    WHERE pr.co_fat_cidadao_pec = p_co_cidadao
      AND pr.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND dp.co_proced = '0301100039'
      AND cbo_no_grupo(nu_cbo_de(pr.co_dim_cbo_1), p_cbo)
  ) t;
$$;

-- datas distintas de visita domiciliar (MIVDT) por CBO elegível numa janela
CREATE OR REPLACE FUNCTION datas_visitas_domiciliares(p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date)
RETURNS date[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(array_agg(DISTINCT t.dt_registro ORDER BY t.dt_registro), ARRAY[]::date[])
  FROM esus.tb_fat_visita_domiciliar v
  JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = v.co_dim_tempo
  WHERE v.co_fat_cidadao_pec = p_co_cidadao
    AND t.dt_registro BETWEEN p_desde AND p_ate
    AND cbo_no_grupo(nu_cbo_de(v.co_dim_cbo), p_cbo);
$$;

-- true se há pelo menos p_min_visitas datas de visita, respeitando intervalo mínimo entre a
-- 1ª e a última quando p_intervalo_min_dias for informado (aproximação: não valida par-a-par).
CREATE OR REPLACE FUNCTION atingiu_visitas_domiciliares(
  p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date, p_min_visitas int, p_intervalo_min_dias int DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_datas date[];
BEGIN
  v_datas := datas_visitas_domiciliares(p_co_cidadao, p_cbo, p_desde, p_ate);
  IF array_length(v_datas, 1) IS NULL OR array_length(v_datas, 1) < p_min_visitas THEN
    RETURN false;
  END IF;
  IF p_intervalo_min_dias IS NOT NULL AND p_min_visitas >= 2 THEN
    RETURN (v_datas[array_length(v_datas, 1)] - v_datas[1]) >= p_intervalo_min_dias;
  END IF;
  RETURN true;
END;
$$;

-- número de doses de um imunobiológico (por nu_identificador, ver tb_dim_imunobiologico)
CREATE OR REPLACE FUNCTION contar_doses_vacina(
  p_co_cidadao bigint, p_codigos_vacina text[], p_desde date DEFAULT NULL, p_ate date DEFAULT NULL
) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT count(DISTINCT vv.co_seq_fat_vacinacao_vacina)
  FROM esus.tb_fat_vacinacao v
  JOIN esus.tb_fat_vacinacao_vacina vv ON vv.co_fat_vacinacao = v.co_seq_fat_vacinacao
  JOIN esus.tb_dim_imunobiologico im ON im.co_seq_dim_imunobiologico = vv.co_dim_imunobiologico
  WHERE v.co_fat_cidadao_pec = p_co_cidadao
    AND im.nu_identificador = ANY(p_codigos_vacina)
    AND (p_desde IS NULL OR v.dt_inicial_atendimento::date >= p_desde)
    AND (p_ate IS NULL OR v.dt_inicial_atendimento::date <= p_ate);
$$;

-- exame/procedimento SIGTAP (avaliado ou solicitado) registrado numa janela
CREATE OR REPLACE FUNCTION tem_procedimento(p_co_cidadao bigint, p_codigos_sigtap text[], p_desde date, p_ate date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM esus.tb_fat_atd_ind_procedimentos pr
    JOIN esus.tb_dim_procedimento dp
      ON dp.co_seq_dim_procedimento IN (pr.co_dim_procedimento_avaliado, pr.co_dim_procedimento_solicitado)
    WHERE pr.co_fat_cidadao_pec = p_co_cidadao
      AND pr.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND dp.co_proced = ANY(p_codigos_sigtap)
  );
$$;

-- atendimento odontológico (MIAOI) por CBO elegível (cirurgião-dentista/TSB) numa janela
CREATE OR REPLACE FUNCTION tem_atendimento_odontologico(p_co_cidadao bigint, p_cbo text[], p_desde date, p_ate date)
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM esus.tb_fat_atendimento_odonto o
    WHERE o.co_fat_cidadao_pec = p_co_cidadao
      AND o.dt_inicial_atendimento::date BETWEEN p_desde AND p_ate
      AND cbo_no_grupo(nu_cbo_de(o.co_dim_cbo_1), p_cbo)
  );
$$;

CREATE OR REPLACE FUNCTION criterio_id(p_indicador_id uuid, p_codigo text) RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT id FROM boas_praticas_criterios WHERE indicador_id = p_indicador_id AND codigo_criterio = p_codigo;
$$;

-- ===================== C2: Cuidado no desenvolvimento infantil =====================
-- Denominador: crianças com até 2 anos de vida vinculadas à equipe (Nota C2, item 4.1).
CREATE OR REPLACE PROCEDURE calcular_c2(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_cbo_medida text[] := ARRAY['2235','2231','2251','2252','2253','515105','322255','2232','2234','2236','2238','2237','2241','2239'];
  v_cbo_visita text[] := ARRAY['322255','515105'];
  v_eq record; v_p record;
  v_pontos numeric; v_soma numeric; v_n int;
  v_datas date[];
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C2';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_soma := 0; v_n := 0;

    FOR v_p IN
      SELECT * FROM cidadaos_vinculados_equipe(v_eq.id)
      WHERE dt_nascimento IS NOT NULL AND dt_nascimento > v_fim - interval '2 years'
    LOOP
      v_n := v_n + 1;
      v_pontos := 0;

      -- (A) 1ª consulta até 30º dia de vida
      DECLARE v_a boolean;
      BEGIN
        v_a := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_p.dt_nascimento, v_p.dt_nascimento + 30) > 0;
        IF v_a THEN v_pontos := v_pontos + 20; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
      END;

      -- (B) >=9 consultas até 2 anos
      DECLARE v_b boolean;
      BEGIN
        v_b := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_p.dt_nascimento, least(v_fim, v_p.dt_nascimento + interval '2 years')::date) >= 9;
        IF v_b THEN v_pontos := v_pontos + 20; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
      END;

      -- (C) >=9 registros de peso+altura até 2 anos
      DECLARE v_c boolean;
      BEGIN
        v_c := contar_peso_altura(v_p.co_cidadao, v_cbo_medida, v_p.dt_nascimento, least(v_fim, v_p.dt_nascimento + interval '2 years')::date) >= 9;
        IF v_c THEN v_pontos := v_pontos + 20; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
      END;

      -- (D) >=2 visitas ACS/TACS: 1ª até 30 dias, 2ª até 6 meses
      DECLARE v_d boolean;
      BEGIN
        v_datas := datas_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_p.dt_nascimento, least(v_fim, v_p.dt_nascimento + interval '6 months')::date);
        v_d := EXISTS (SELECT 1 FROM unnest(v_datas) d WHERE d <= v_p.dt_nascimento + 30)
           AND array_length(v_datas, 1) >= 2;
        IF v_d THEN v_pontos := v_pontos + 20; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
      END;

      -- (E) esquema vacinal completo (penta 3d, VIP 3d, SCR 2d, pneumo 2d) até 2 anos
      DECLARE v_e boolean;
      BEGIN
        v_e :=
          contar_doses_vacina(v_p.co_cidadao, ARRAY['09','17','29','39','42','43','46','47','58'], v_p.dt_nascimento, v_fim) >= 3
          AND contar_doses_vacina(v_p.co_cidadao, ARRAY['22','29','43','58'], v_p.dt_nascimento, v_fim) >= 3
          AND contar_doses_vacina(v_p.co_cidadao, ARRAY['24','56'], v_p.dt_nascimento, v_fim) >= 2
          AND contar_doses_vacina(v_p.co_cidadao, ARRAY['26','59','106','107'], v_p.dt_nascimento, v_fim) >= 2;
        IF v_e THEN v_pontos := v_pontos + 20; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'E'), v_e, p_quadrimestre, p_ano);
      END;

      v_soma := v_soma + v_pontos;
    END LOOP;

    IF v_n > 0 THEN
      CALL upsert_resultado_indicador(v_eq.id, v_indicador_id, p_quadrimestre, p_ano, v_soma, v_n * 100);
    END IF;
  END LOOP;
END;
$$;

-- ===================== C3: Cuidado na gestação e puerpério =====================
CREATE OR REPLACE PROCEDURE calcular_c3(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_cbo_medida text[] := ARRAY['2235','2231','2251','2252','2253','2232','2234','2236','2238','2237','2241','3222','2239','3224'];
  v_cbo_visita text[] := ARRAY['3222','515105'];
  v_cids_gestacao text[] := ARRAY['O10','O11','O12','O13','O14','O15','O16','O20','O21','O22','O23','O24','O25','O26','O28','O29','O30','O31','O32','O33','O34','O35','O36','O40','O41','O43','O44','O46','O47','O48','O75.2','O75.3','O98','O99.0','O99.1','O99.2','O99.3','O99.4','O99.5','O99.6','O99.7','Z32.1','Z33','Z34','Z35','Z36','Z64.0'];
  v_ciaps_gestacao text[] := ARRAY['W03','W78','W79','W81','W84','W85'];
  v_cids_puerperio text[] := ARRAY['F53','F53.0','F53.1','F53.8','F53.9','M83.0','O10','O15.2','O26.6','O72.2','O72.3','O85','O86','O87','O90','O91','O92','O94','O98','O99','Z37.0','Z37.1','Z37.2','Z37.3','Z37.4','Z37.5','Z37.6','Z37.7','Z37.9','Z38','Z39'];
  v_ciaps_puerperio text[] := ARRAY['48','49','P29','W18','W19','W70','W90','W91','W92','W93','W94','W95','W96'];
  v_cids_exclusao text[] := ARRAY['O02','O02.1','O03','O04','O05','O06','Z30.3'];
  v_ciaps_exclusao text[] := ARRAY['W82','W83'];
  v_codigos_ist text[] := ARRAY['0214010040','0214010279','0214010058','0214010074','0214010082','0214010252','0214010090','0214010309','0214010104','0214010236','0213010780','0213010500','0202030109','0202030110','0202030117','0202030784','0202030970','0213010208','0202030059','0202030679','0202030300','0202030318'];
  v_eq record; v_p record;
  v_pontos numeric; v_soma numeric; v_n int;
  v_elegivel boolean;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C3';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_soma := 0; v_n := 0;

    FOR v_p IN SELECT * FROM cidadaos_vinculados_equipe(v_eq.id) LOOP
      v_elegivel := NOT tem_condicao_ativa(v_p.co_cidadao, v_cids_exclusao, v_ciaps_exclusao)
                AND (tem_condicao_ativa(v_p.co_cidadao, v_cids_gestacao, v_ciaps_gestacao)
                     OR tem_condicao_ativa(v_p.co_cidadao, v_cids_puerperio, v_ciaps_puerperio));
      CONTINUE WHEN NOT v_elegivel;

      v_n := v_n + 1;
      v_pontos := 0;

      -- para simplificar sem tb_pre_natal (ver aviso no topo do arquivo), usa o quadrimestre
      -- inteiro como janela de referência para as boas práticas ao longo da gestação/puerpério.
      DECLARE v_a boolean; v_b boolean; v_c boolean; v_d boolean; v_e boolean; v_f boolean;
              v_g boolean; v_h boolean; v_i boolean; v_j boolean; v_k boolean;
      BEGIN
        v_a := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_inicio, v_fim) > 0;
        v_b := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_inicio, v_fim) >= 7;
        v_c := contar_pressao(v_p.co_cidadao, v_cbo_medida, v_inicio, v_fim) >= 7;
        v_d := contar_peso_altura(v_p.co_cidadao, v_cbo_medida, v_inicio, v_fim) >= 7;
        v_e := atingiu_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_inicio, v_fim, 3);
        v_f := contar_doses_vacina(v_p.co_cidadao, ARRAY['57'], v_inicio, v_fim) >= 1;
        v_g := tem_procedimento(v_p.co_cidadao, v_codigos_ist, v_inicio, v_fim);
        v_h := tem_procedimento(v_p.co_cidadao, v_codigos_ist, v_inicio, v_fim);
        v_i := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_inicio, v_fim) > 0;
        v_j := atingiu_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_inicio, v_fim, 1);
        v_k := tem_atendimento_odontologico(v_p.co_cidadao, ARRAY['2232', '3224'], v_inicio, v_fim);

        IF v_a THEN v_pontos := v_pontos + 10; END IF;
        IF v_b THEN v_pontos := v_pontos + 9; END IF;
        IF v_c THEN v_pontos := v_pontos + 9; END IF;
        IF v_d THEN v_pontos := v_pontos + 9; END IF;
        IF v_e THEN v_pontos := v_pontos + 9; END IF;
        IF v_f THEN v_pontos := v_pontos + 9; END IF;
        IF v_g THEN v_pontos := v_pontos + 9; END IF;
        IF v_h THEN v_pontos := v_pontos + 9; END IF;
        IF v_i THEN v_pontos := v_pontos + 9; END IF;
        IF v_j THEN v_pontos := v_pontos + 9; END IF;
        IF v_k THEN v_pontos := v_pontos + 9; END IF;

        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'E'), v_e, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'F'), v_f, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'G'), v_g, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'H'), v_h, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'I'), v_i, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'J'), v_j, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'K'), v_k, p_quadrimestre, p_ano);
      END;

      v_soma := v_soma + v_pontos;
    END LOOP;

    IF v_n > 0 THEN
      CALL upsert_resultado_indicador(v_eq.id, v_indicador_id, p_quadrimestre, p_ano, v_soma, v_n * 100);
    END IF;
  END LOOP;
END;
$$;

-- ===================== C4: Cuidado da pessoa com diabetes =====================
CREATE OR REPLACE PROCEDURE calcular_c4(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date; v_desde_12m date; v_desde_6m date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_cbo_medida text[] := ARRAY['2235','2231','2251','2252','2253','2232','2234','2236','2238','2237','2241','3222','2239','3224'];
  v_cbo_visita text[] := ARRAY['322255','515105'];
  v_cids text[] := ARRAY['E10','E11','E14'];
  v_ciaps text[] := ARRAY['T89','T90'];
  v_eq record; v_p record;
  v_pontos numeric; v_soma numeric; v_n int;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C4';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);
  v_desde_12m := v_fim - interval '12 months';
  v_desde_6m := v_fim - interval '6 months';

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_soma := 0; v_n := 0;

    FOR v_p IN
      SELECT * FROM cidadaos_vinculados_equipe(v_eq.id) WHERE tem_condicao_ativa(co_cidadao, v_cids, v_ciaps)
    LOOP
      v_n := v_n + 1;
      v_pontos := 0;

      DECLARE v_a boolean; v_b boolean; v_c boolean; v_d boolean; v_e boolean; v_f boolean;
      BEGIN
        v_a := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_desde_6m, v_fim) > 0;
        v_b := contar_pressao(v_p.co_cidadao, v_cbo_medida, v_desde_6m, v_fim) > 0;
        v_c := contar_peso_altura(v_p.co_cidadao, v_cbo_medida, v_desde_12m, v_fim) > 0;
        v_d := atingiu_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_desde_12m, v_fim, 2, 30);
        -- (E) não filtra por CBO do registro (a Nota já restringe bastante via CBO na tabela
        -- SIGTAP; o código do procedimento em si já é suficientemente específico).
        v_e := tem_procedimento(v_p.co_cidadao, ARRAY['0202010503'], v_desde_12m, v_fim);
        v_f := tem_procedimento(v_p.co_cidadao, ARRAY['0301040095'], v_desde_12m, v_fim);

        IF v_a THEN v_pontos := v_pontos + 20; END IF;
        IF v_b THEN v_pontos := v_pontos + 15; END IF;
        IF v_c THEN v_pontos := v_pontos + 15; END IF;
        IF v_d THEN v_pontos := v_pontos + 20; END IF;
        IF v_e THEN v_pontos := v_pontos + 15; END IF;
        IF v_f THEN v_pontos := v_pontos + 15; END IF;

        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'E'), v_e, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'F'), v_f, p_quadrimestre, p_ano);
      END;

      v_soma := v_soma + v_pontos;
    END LOOP;

    IF v_n > 0 THEN
      CALL upsert_resultado_indicador(v_eq.id, v_indicador_id, p_quadrimestre, p_ano, v_soma, v_n * 100);
    END IF;
  END LOOP;
END;
$$;

-- ===================== C5: Cuidado da pessoa com hipertensão =====================
CREATE OR REPLACE PROCEDURE calcular_c5(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date; v_desde_12m date; v_desde_6m date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_cbo_medida text[] := ARRAY['2235','2231','2251','2252','2253','2232','2234','2236','2238','2237','2241','3222','2239','3224'];
  v_cbo_visita text[] := ARRAY['322255','515105'];
  v_cids text[] := ARRAY['I10','I11','I11.0','I11.9','I12','I12.0','I12.9','I13','I13.0','I13.1','I13.2','I13.9','I15','I15.0','I15.1','I15.2','I15.8','I15.9','O10','O10.0','O10.1','O10.2','O10.3','O10.4','O10.9','O11'];
  v_ciaps text[] := ARRAY['K86','K87'];
  v_eq record; v_p record;
  v_pontos numeric; v_soma numeric; v_n int;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C5';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);
  v_desde_12m := v_fim - interval '12 months';
  v_desde_6m := v_fim - interval '6 months';

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_soma := 0; v_n := 0;

    FOR v_p IN
      SELECT * FROM cidadaos_vinculados_equipe(v_eq.id) WHERE tem_condicao_ativa(co_cidadao, v_cids, v_ciaps)
    LOOP
      v_n := v_n + 1;
      v_pontos := 0;

      DECLARE v_a boolean; v_b boolean; v_c boolean; v_d boolean;
      BEGIN
        v_a := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_desde_6m, v_fim) > 0;
        v_b := contar_pressao(v_p.co_cidadao, v_cbo_medida, v_desde_6m, v_fim) > 0;
        v_c := contar_peso_altura(v_p.co_cidadao, v_cbo_medida, v_desde_12m, v_fim) > 0;
        v_d := atingiu_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_desde_12m, v_fim, 2, 30);

        IF v_a THEN v_pontos := v_pontos + 25; END IF;
        IF v_b THEN v_pontos := v_pontos + 25; END IF;
        IF v_c THEN v_pontos := v_pontos + 25; END IF;
        IF v_d THEN v_pontos := v_pontos + 25; END IF;

        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
      END;

      v_soma := v_soma + v_pontos;
    END LOOP;

    IF v_n > 0 THEN
      CALL upsert_resultado_indicador(v_eq.id, v_indicador_id, p_quadrimestre, p_ano, v_soma, v_n * 100);
    END IF;
  END LOOP;
END;
$$;

-- ===================== C6: Cuidado da pessoa idosa =====================
CREATE OR REPLACE PROCEDURE calcular_c6(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date; v_desde_12m date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_cbo_medida text[] := ARRAY['2235','2231','2251','2252','2253','322255','515105','2232','2234','2236','2238','2237','2241','2239'];
  v_cbo_visita text[] := ARRAY['322255','515105'];
  v_eq record; v_p record;
  v_pontos numeric; v_soma numeric; v_n int;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C6';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);
  v_desde_12m := v_fim - interval '12 months';

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_soma := 0; v_n := 0;

    FOR v_p IN
      SELECT * FROM cidadaos_vinculados_equipe(v_eq.id)
      WHERE dt_nascimento IS NOT NULL AND dt_nascimento <= v_fim - interval '60 years'
    LOOP
      v_n := v_n + 1;
      v_pontos := 0;

      DECLARE v_a boolean; v_b boolean; v_c boolean; v_d boolean;
      BEGIN
        v_a := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_desde_12m, v_fim) > 0;
        v_b := contar_peso_altura(v_p.co_cidadao, v_cbo_medida, v_desde_12m, v_fim) > 0;
        v_c := atingiu_visitas_domiciliares(v_p.co_cidadao, v_cbo_visita, v_desde_12m, v_fim, 2, 30);
        v_d := contar_doses_vacina(v_p.co_cidadao, ARRAY['33','77'], v_desde_12m, v_fim) >= 1;

        IF v_a THEN v_pontos := v_pontos + 25; END IF;
        IF v_b THEN v_pontos := v_pontos + 25; END IF;
        IF v_c THEN v_pontos := v_pontos + 25; END IF;
        IF v_d THEN v_pontos := v_pontos + 25; END IF;

        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
      END;

      v_soma := v_soma + v_pontos;
    END LOOP;

    IF v_n > 0 THEN
      CALL upsert_resultado_indicador(v_eq.id, v_indicador_id, p_quadrimestre, p_ano, v_soma, v_n * 100);
    END IF;
  END LOOP;
END;
$$;

-- ===================== C7: Cuidado da mulher/homem trans na prevenção do câncer =====================
-- Cada boa prática tem faixa etária e denominador PRÓPRIOS (fórmula oficial: A=(a/b)x20,
-- B=(c/d)x30, C=(e/f)x30, D=(g/h)x20) — diferente de C2-C6, que somam pontos por pessoa sobre
-- um único denominador. Aqui a agregação é feita diretamente por equipe.
CREATE OR REPLACE PROCEDURE calcular_c7(p_quadrimestre "Quadrimestre", p_ano int) LANGUAGE plpgsql AS $$
DECLARE
  v_indicador_id uuid;
  v_inicio date; v_fim date; v_desde_12m date; v_desde_24m date; v_desde_36m date; v_desde_60m date;
  v_cbo_consulta text[] := ARRAY['2235','2231','2251','2252','2253'];
  v_codigos_colo text[] := ARRAY['0201020033','0203010086','0203010019','0201020076','0201020084'];
  v_codigos_hpv_molecular text[] := ARRAY['0202100251'];
  v_codigos_mama text[] := ARRAY['0204030030','0204030188'];
  v_eq record; v_p record;
  v_num_a numeric := 0; v_den_a numeric := 0;
  v_num_b numeric := 0; v_den_b numeric := 0;
  v_num_c numeric := 0; v_den_c numeric := 0;
  v_num_d numeric := 0; v_den_d numeric := 0;
  v_idade int;
  v_a boolean; v_b boolean; v_c boolean; v_d boolean;
BEGIN
  SELECT id INTO v_indicador_id FROM indicadores_catalogo WHERE codigo = 'C7';
  IF v_indicador_id IS NULL THEN RETURN; END IF;
  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);
  -- `v_fim - interval '...'` inline dá timestamp (não date), quebrando a assinatura date/date de
  -- contar_atendimentos/tem_procedimento — bug real encontrado em 2026-09-13 (C7 falhando
  -- silenciosamente em todo recalcular_indicadores_qualidade(), só não em toda execução porque
  -- depende de existir alguém na faixa etária do critério que dispara a chamada). Atribuir a uma
  -- variável `date` força o cast implícito, igual já é feito em v_desde_12m/v_desde_6m nos
  -- cálculos de C4-C6 acima.
  v_desde_12m := v_fim - interval '12 months';
  v_desde_24m := v_fim - interval '24 months';
  v_desde_36m := v_fim - interval '36 months';
  v_desde_60m := v_fim - interval '60 months';

  FOR v_eq IN SELECT id FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    DELETE FROM boas_praticas_pontuacao_pessoa
     WHERE equipe_id = v_eq.id AND indicador_id = v_indicador_id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_num_a := 0; v_den_a := 0; v_num_b := 0; v_den_b := 0;
    v_num_c := 0; v_den_c := 0; v_num_d := 0; v_den_d := 0;

    FOR v_p IN
      SELECT * FROM cidadaos_vinculados_equipe(v_eq.id)
      WHERE dt_nascimento IS NOT NULL
        AND (upper(no_sexo) = 'FEMININO' OR upper(coalesce(tp_identidade_genero, '')) LIKE '%HOMEM TRANSG%')
        AND upper(coalesce(tp_identidade_genero, '')) NOT LIKE '%MULHER TRANSG%'
    LOOP
      v_idade := extract(year FROM age(v_fim, v_p.dt_nascimento));
      IF v_idade < 9 OR v_idade > 69 THEN CONTINUE; END IF;

      -- (A) colo do útero, 25-64 anos
      IF v_idade BETWEEN 25 AND 64 THEN
        v_den_a := v_den_a + 1;
        v_a := tem_procedimento(v_p.co_cidadao, v_codigos_colo, v_desde_36m, v_fim)
            OR tem_procedimento(v_p.co_cidadao, v_codigos_hpv_molecular, v_desde_60m, v_fim);
        IF v_a THEN v_num_a := v_num_a + 1; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'A'), v_a, p_quadrimestre, p_ano);
      END IF;

      -- (B) HPV, 9-14 anos, sexo feminino de registro (exclui homem transgênero)
      IF v_idade BETWEEN 9 AND 14 AND upper(v_p.no_sexo) = 'FEMININO' THEN
        v_den_b := v_den_b + 1;
        v_b := contar_doses_vacina(v_p.co_cidadao, ARRAY['67','93']) >= 1;
        IF v_b THEN v_num_b := v_num_b + 1; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'B'), v_b, p_quadrimestre, p_ano);
      END IF;

      -- (C) saúde sexual e reprodutiva, 14-69 anos
      IF v_idade BETWEEN 14 AND 69 THEN
        v_den_c := v_den_c + 1;
        v_c := contar_atendimentos(v_p.co_cidadao, v_cbo_consulta, v_desde_12m, v_fim) > 0;
        IF v_c THEN v_num_c := v_num_c + 1; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'C'), v_c, p_quadrimestre, p_ano);
      END IF;

      -- (D) mama, 50-69 anos
      IF v_idade BETWEEN 50 AND 69 THEN
        v_den_d := v_den_d + 1;
        v_d := tem_procedimento(v_p.co_cidadao, v_codigos_mama, v_desde_24m, v_fim);
        IF v_d THEN v_num_d := v_num_d + 1; END IF;
        CALL registrar_pontuacao_pessoa_segura(v_eq.id, v_indicador_id, v_p.cns, criterio_id(v_indicador_id, 'D'), v_d, p_quadrimestre, p_ano);
      END IF;
    END LOOP;

    IF v_den_a + v_den_b + v_den_c + v_den_d > 0 THEN
      -- Fórmula oficial do indicador = soma dos 4 sub-indicadores ponderados (20+30+30+20=100).
      CALL upsert_resultado_indicador(
        v_eq.id, v_indicador_id, p_quadrimestre, p_ano,
        (CASE WHEN v_den_a > 0 THEN v_num_a / v_den_a * 20 ELSE 0 END)
        + (CASE WHEN v_den_b > 0 THEN v_num_b / v_den_b * 30 ELSE 0 END)
        + (CASE WHEN v_den_c > 0 THEN v_num_c / v_den_c * 30 ELSE 0 END)
        + (CASE WHEN v_den_d > 0 THEN v_num_d / v_den_d * 20 ELSE 0 END),
        100
      );
    END IF;
  END LOOP;
END;
$$;
