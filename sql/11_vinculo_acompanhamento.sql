-- Componente Vínculo e Acompanhamento Territorial — Nota Técnica nº 30/2025-CGESCO/DESCO/SAPS/MS
-- (lida integralmente pelo usuário em 2026-09-13, fornecida em
-- fichas tecnicas/nota tecnica30/nota-tecnica-no-30-2025-cgesco-desco-saps-ms.pdf). Metodologia
-- diferente dos indicadores C1-C7/B1-B6/M1-M2: duas dimensões (Cadastro 30%/até 3,00 pontos,
-- Acompanhamento 70%/até 7,00 pontos + bônus de satisfação), com parâmetro por porte
-- populacional do município (Anexo da Portaria SAPS/MS nº 161/2024).
--
-- APROXIMAÇÕES CONSCIENTES — decididas com o usuário em 2026-09-13, documentadas (não
-- fabricadas). O resultado aqui é uma ESTIMATIVA para acompanhamento gerencial interno, não
-- substitui o cálculo oficial do SISAB/Ministério da Saúde:
--  1. Fator de multiplicação do cadastro (item 3.4.d): sempre 0,75 (só MICI), nunca 1,5
--     (MICI+MICDT) — tb_cds_cad_individual não referencia o cadastro domiciliar da casa da
--     pessoa nesta instalação (sem FK para domicílio), então não dá pra confirmar por pessoa se
--     ela também tem MICDT válido/atualizado.
--  2. Só exclui "Fora de área" (st_fora_area, real). "Mudança de território" (item 3.4.c) não é
--     aplicado: cadastros_individuais.cidadao_cns nesta instalação é um hash (vem de
--     tb_cds_cad_individual.nu_cns_cidadao), não joinável com o CNS/id real usado por
--     tb_cidadao_vinculacao_equipe.st_saida_cadastro_territorio.
--  3. Bolsa Família/BPC (Passo 2 da Dimensão Acompanhamento) e satisfação do "Meu SUS Digital"
--     (item 3.13) não vêm do e-SUS — CadÚnico e Meu SUS Digital são sistemas federais
--     separados, sem integração aqui. Preenchidos manualmente: ver tabelas
--     beneficiarios_vulneraveis (chaveada pelo CNS real, de propósito — ver comentário no
--     schema.prisma) e satisfacao_equipe.
--  4. "Pessoa acompanhada" (item 2.6.4) usa como prática de cuidado: MIAI (tb_fat_atendimento_
--     individual), MIAOI (tb_fat_atendimento_odonto), MIAC (tb_fat_atvdd_coletiva_part), MIVDT
--     (tb_fat_visita_domiciliar); como procedimento: MIP (tb_fat_atd_ind_procedimentos) e MIV
--     (tb_fat_vacinacao). MIMCA (marcadores de consumo alimentar) não está disponível nesta
--     instalação — não incluída na lista de tabelas expostas pelo FDW.
--  5. População da Dimensão Acompanhamento = mesma de cidadaos_vinculados_equipe() (vínculo
--     territorial ativo e válido), em vez de "tem cadastro individual (MICI/MICI+MICDT)" ao pé
--     da letra do item 3.9 — mesmo motivo do item 1 (hash não joinável com o CNS real).

-- Anexo da Portaria SAPS/MS nº 161/2024 — parâmetro de pessoas vinculadas por equipe, por porte
-- populacional do município (conferido em 2026-09-13 direto no texto oficial da portaria; a
-- cópia local da Nota Técnica 30 tinha essa tabela com a ordem das células corrompida pela
-- extração de PDF, então os valores abaixo NÃO vieram de lá).
CREATE OR REPLACE FUNCTION parametro_vinculo(p_populacao int, p_tipo "TipoEquipe", p_carga_horaria int)
RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_tipo = 'ESF' THEN
      CASE WHEN p_populacao <= 20000 THEN 2000 WHEN p_populacao <= 50000 THEN 2500 WHEN p_populacao <= 100000 THEN 2750 ELSE 3000 END
    WHEN p_carga_horaria = 20 THEN
      CASE WHEN p_populacao <= 20000 THEN 1000 WHEN p_populacao <= 50000 THEN 1250 WHEN p_populacao <= 100000 THEN 1375 ELSE 1500 END
    ELSE
      -- eAP 30h — também o default quando carga_horaria_semanal não foi preenchida pelo
      -- coordenador: denominador maior evita inflar o resultado sem confirmação real da carga
      -- horária (mesmo campo manual já usado por B1/B4, ver sql/09_indicadores_b1_b6.sql).
      CASE WHEN p_populacao <= 20000 THEN 1500 WHEN p_populacao <= 50000 THEN 1875 WHEN p_populacao <= 100000 THEN 2063 ELSE 2250 END
  END;
$$;

-- "Pessoa acompanhada" (item 2.6.4): mais de 1 contato assistencial nos últimos 12 meses, sendo
-- pelo menos 1 prática de cuidado (o outro pode ser prática de cuidado OU procedimento).
CREATE OR REPLACE FUNCTION eh_pessoa_acompanhada(p_co_cidadao bigint, p_fim date) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH contatos AS (
    SELECT true AS pratica_cuidado
    FROM esus.tb_fat_atendimento_individual
    WHERE co_fat_cidadao_pec = p_co_cidadao AND dt_inicial_atendimento::date BETWEEN (p_fim - interval '12 months')::date AND p_fim
    UNION ALL
    SELECT true
    FROM esus.tb_fat_atendimento_odonto
    WHERE co_fat_cidadao_pec = p_co_cidadao AND dt_inicial_atendimento::date BETWEEN (p_fim - interval '12 months')::date AND p_fim
    UNION ALL
    SELECT true
    FROM esus.tb_fat_atvdd_coletiva_part part
    JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
    WHERE part.co_fat_cidadao_pec = p_co_cidadao AND t.dt_registro BETWEEN (p_fim - interval '12 months')::date AND p_fim
    UNION ALL
    SELECT true
    FROM esus.tb_fat_visita_domiciliar v
    JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = v.co_dim_tempo
    WHERE v.co_fat_cidadao_pec = p_co_cidadao AND t.dt_registro BETWEEN (p_fim - interval '12 months')::date AND p_fim
    UNION ALL
    SELECT false
    FROM esus.tb_fat_atd_ind_procedimentos
    WHERE co_fat_cidadao_pec = p_co_cidadao AND dt_inicial_atendimento::date BETWEEN (p_fim - interval '12 months')::date AND p_fim
    UNION ALL
    SELECT false
    FROM esus.tb_fat_vacinacao
    WHERE co_fat_cidadao_pec = p_co_cidadao AND dt_inicial_atendimento::date BETWEEN (p_fim - interval '12 months')::date AND p_fim
  )
  SELECT count(*) >= 2 AND bool_or(pratica_cuidado) FROM contatos;
$$;

CREATE OR REPLACE PROCEDURE calcular_vinculo_acompanhamento(p_quadrimestre "Quadrimestre", p_ano int)
LANGUAGE plpgsql AS $$
DECLARE
  v_inicio date; v_fim date;
  v_populacao int;
  r record;
  v_p record;
  v_cadastro_valido int;
  v_indice_cadastro numeric;
  v_parametro int;
  v_resultado_cadastro numeric;
  v_escore_cadastro numeric;
  v_classificacao_cadastro "Classificacao";
  v_sem_criterio int; v_idoso_crianca int; v_bpc_pbf int; v_idoso_crianca_bpc_pbf int;
  v_indice_acompanhamento numeric;
  v_resultado_acompanhamento numeric;
  v_escore_acompanhamento_base numeric;
  v_bonus numeric;
  v_escore_acompanhamento numeric;
  v_classificacao_acompanhamento "Classificacao";
  v_escore_final numeric;
  v_classificacao_final "Classificacao";
  v_pct_avaliados numeric;
  v_idade int;
  v_eh_bpc boolean;
BEGIN
  SELECT populacao_municipio INTO v_populacao FROM configuracao_sistema WHERE id = 1;
  IF v_populacao IS NULL THEN
    RAISE WARNING 'calcular_vinculo_acompanhamento: população do município não configurada em Configurações — abortando';
    RETURN;
  END IF;

  SELECT inicio, fim INTO v_inicio, v_fim FROM periodo_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN SELECT id, tipo, carga_horaria_semanal FROM equipes WHERE tipo IN ('ESF', 'EAP') AND ativo LOOP
    v_parametro := parametro_vinculo(v_populacao, r.tipo, r.carga_horaria_semanal);
    -- item 3.5.b: se a população do município for menor que o parâmetro por porte, usa a
    -- própria população como substituto.
    v_parametro := LEAST(v_parametro, v_populacao);

    -- ===== Dimensão Cadastro (Passos 1-3, itens 3.4-3.7) =====
    WITH ultimo_cadastro AS (
      SELECT DISTINCT ON (cidadao_cns) cidadao_cns, data_cadastro, fora_de_area
      FROM cadastros_individuais
      WHERE equipe_id = r.id
      ORDER BY cidadao_cns, data_cadastro DESC
    )
    SELECT count(*) INTO v_cadastro_valido
    FROM ultimo_cadastro
    WHERE NOT fora_de_area AND data_cadastro BETWEEN (v_fim - interval '24 months')::date AND v_fim;

    v_indice_cadastro := v_cadastro_valido * 0.75;
    v_resultado_cadastro := CASE WHEN v_parametro = 0 THEN 0 ELSE round(v_indice_cadastro / v_parametro * 100, 2) END;

    v_escore_cadastro := CASE
      WHEN v_resultado_cadastro > 85 THEN 3.00
      WHEN v_resultado_cadastro >= 65 THEN 2.25
      WHEN v_resultado_cadastro >= 45 THEN 1.50
      ELSE 0.75
    END;
    v_classificacao_cadastro := CASE
      WHEN v_resultado_cadastro > 85 THEN 'otimo'
      WHEN v_resultado_cadastro >= 65 THEN 'bom'
      WHEN v_resultado_cadastro >= 45 THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";

    -- item 3.7: se o nº de pessoas cadastradas ultrapassar o parâmetro (limite máximo), a
    -- classificação não pode passar de "bom", mesmo que o percentual bruto desse "ótimo".
    IF v_cadastro_valido > v_parametro AND v_classificacao_cadastro = 'otimo' THEN
      v_classificacao_cadastro := 'bom';
      v_escore_cadastro := 2.25;
    END IF;

    -- ===== Dimensão Acompanhamento (Passos 1-4, item 3.13) =====
    v_sem_criterio := 0; v_idoso_crianca := 0; v_bpc_pbf := 0; v_idoso_crianca_bpc_pbf := 0;

    FOR v_p IN SELECT * FROM cidadaos_vinculados_equipe(r.id) LOOP
      IF NOT eh_pessoa_acompanhada(v_p.co_cidadao, v_fim) THEN CONTINUE; END IF;

      v_idade := CASE WHEN v_p.dt_nascimento IS NULL THEN NULL ELSE extract(year FROM age(v_fim, v_p.dt_nascimento)) END;
      v_eh_bpc := EXISTS (SELECT 1 FROM beneficiarios_vulneraveis WHERE cidadao_cns = v_p.cns);

      IF (v_idade IS NOT NULL AND (v_idade < 5 OR v_idade >= 60)) AND v_eh_bpc THEN
        v_idoso_crianca_bpc_pbf := v_idoso_crianca_bpc_pbf + 1;
      ELSIF v_idade IS NOT NULL AND (v_idade < 5 OR v_idade >= 60) THEN
        v_idoso_crianca := v_idoso_crianca + 1;
      ELSIF v_eh_bpc THEN
        v_bpc_pbf := v_bpc_pbf + 1;
      ELSE
        v_sem_criterio := v_sem_criterio + 1;
      END IF;
    END LOOP;

    v_indice_acompanhamento := v_sem_criterio * 1.0 + v_idoso_crianca * 1.2 + v_bpc_pbf * 1.3 + v_idoso_crianca_bpc_pbf * 2.5;
    v_resultado_acompanhamento := CASE WHEN v_parametro = 0 THEN 0 ELSE round(v_indice_acompanhamento / v_parametro * 100, 2) END;

    v_escore_acompanhamento_base := CASE
      WHEN v_resultado_acompanhamento > 85 THEN 7.00
      WHEN v_resultado_acompanhamento >= 65 THEN 5.25
      WHEN v_resultado_acompanhamento >= 45 THEN 3.50
      ELSE 1.75
    END;
    v_classificacao_acompanhamento := CASE
      WHEN v_resultado_acompanhamento > 85 THEN 'otimo'
      WHEN v_resultado_acompanhamento >= 65 THEN 'bom'
      WHEN v_resultado_acompanhamento >= 45 THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";

    -- bônus de satisfação (item 3.13) — só aplica se o coordenador preencheu o % manualmente
    -- pra este quadrimestre; sem isso, bônus = 0 (não inventa um valor).
    SELECT percentual_avaliacoes INTO v_pct_avaliados
    FROM satisfacao_equipe WHERE equipe_id = r.id AND quadrimestre = p_quadrimestre AND ano = p_ano;

    v_bonus := CASE WHEN v_pct_avaliados IS NULL THEN 0 WHEN v_pct_avaliados >= 5 THEN 0.30 ELSE 0.15 END;
    v_escore_acompanhamento := LEAST(v_escore_acompanhamento_base + v_bonus, 7.00);

    v_escore_final := v_escore_cadastro + v_escore_acompanhamento;
    v_classificacao_final := CASE
      WHEN v_escore_final > 8.5 THEN 'otimo'
      WHEN v_escore_final >= 7 THEN 'bom'
      WHEN v_escore_final >= 5.0 THEN 'suficiente'
      ELSE 'regular'
    END::"Classificacao";

    INSERT INTO resultados_vinculo_acompanhamento (
      id, equipe_id, quadrimestre, ano,
      pessoas_cadastro_valido, indice_ponderado_cadastro, parametro_porte, resultado_cadastro, escore_cadastro, classificacao_cadastro,
      acompanhados_sem_criterio, acompanhados_idoso_ou_crianca, acompanhados_bpc_pbf, acompanhados_idoso_crianca_bpc_pbf,
      indice_ponderado_acompanhamento, resultado_acompanhamento, escore_acompanhamento_base, bonus_satisfacao, escore_acompanhamento, classificacao_acompanhamento,
      escore_final, classificacao_final, calculado_em
    ) VALUES (
      gen_random_uuid(), r.id, p_quadrimestre, p_ano,
      v_cadastro_valido, v_indice_cadastro, v_parametro, v_resultado_cadastro, v_escore_cadastro, v_classificacao_cadastro,
      v_sem_criterio, v_idoso_crianca, v_bpc_pbf, v_idoso_crianca_bpc_pbf,
      v_indice_acompanhamento, v_resultado_acompanhamento, v_escore_acompanhamento_base, v_bonus, v_escore_acompanhamento, v_classificacao_acompanhamento,
      v_escore_final, v_classificacao_final, now()
    )
    ON CONFLICT (equipe_id, quadrimestre, ano) DO UPDATE SET
      pessoas_cadastro_valido = EXCLUDED.pessoas_cadastro_valido,
      indice_ponderado_cadastro = EXCLUDED.indice_ponderado_cadastro,
      parametro_porte = EXCLUDED.parametro_porte,
      resultado_cadastro = EXCLUDED.resultado_cadastro,
      escore_cadastro = EXCLUDED.escore_cadastro,
      classificacao_cadastro = EXCLUDED.classificacao_cadastro,
      acompanhados_sem_criterio = EXCLUDED.acompanhados_sem_criterio,
      acompanhados_idoso_ou_crianca = EXCLUDED.acompanhados_idoso_ou_crianca,
      acompanhados_bpc_pbf = EXCLUDED.acompanhados_bpc_pbf,
      acompanhados_idoso_crianca_bpc_pbf = EXCLUDED.acompanhados_idoso_crianca_bpc_pbf,
      indice_ponderado_acompanhamento = EXCLUDED.indice_ponderado_acompanhamento,
      resultado_acompanhamento = EXCLUDED.resultado_acompanhamento,
      escore_acompanhamento_base = EXCLUDED.escore_acompanhamento_base,
      bonus_satisfacao = EXCLUDED.bonus_satisfacao,
      escore_acompanhamento = EXCLUDED.escore_acompanhamento,
      classificacao_acompanhamento = EXCLUDED.classificacao_acompanhamento,
      escore_final = EXCLUDED.escore_final,
      classificacao_final = EXCLUDED.classificacao_final,
      calculado_em = now();
  END LOOP;
END;
$$;
