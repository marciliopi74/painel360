-- Motor de sincronização e-SUS -> tabelas locais (requisitos 5, 6, 7).
--
-- Nomes de tabela/coluna abaixo foram confirmados em 2026-09-12 contra uma instalação real de
-- e-SUS AB PEC 9.6.13-4 (ver docs/esus-fdw.md para o detalhamento e o que ainda pode variar em
-- outras instalações/versões — em especial tb_prof.no_civil_profissional/no_social_profissional,
-- que não existem em toda customização municipal).

CREATE OR REPLACE PROCEDURE sp_atualizar_progresso(
  p_sincronizacao_id uuid,
  p_etapa text,
  p_processados int
) LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sincronizacoes
     SET etapa_atual = p_etapa,
         processados = p_processados
   WHERE id = p_sincronizacao_id;
  COMMIT;
END;
$$;

CREATE OR REPLACE PROCEDURE sincronizar_esus(p_sincronizacao_id uuid)
LANGUAGE plpgsql AS $$
DECLARE
  v_count int;
BEGIN
  -- Etapa 1: equipes. tb_tipo_equipe.co_seq_tipo_equipe (não co_tipo_equipe) é a PK referenciada
  -- por tb_equipe.tp_equipe — confirmado via join real (57 tipos, equipes resolvendo ESF/ESB/EMULTI).
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'equipes', 0);

  INSERT INTO equipes (id, nome, tipo, ine, ativo, fonte_id)
  SELECT
    gen_random_uuid(),
    e.no_equipe,
    CASE te.sg_tipo_equipe
      WHEN 'ESF'      THEN 'ESF'
      WHEN 'EAP'      THEN 'EAP'
      WHEN 'EMULTI'   THEN 'EMULTI'
      WHEN 'ENASFAP'  THEN 'EMULTI' -- NASF-AP legado, mapeado para EMULTI
      WHEN 'ESB'      THEN 'ESB'
      ELSE 'EAP'
    END::"TipoEquipe",
    e.nu_ine,
    true,
    e.co_seq_equipe
  FROM esus.tb_equipe e
  LEFT JOIN esus.tb_tipo_equipe te ON te.co_seq_tipo_equipe = e.tp_equipe
  ON CONFLICT (fonte_id) DO UPDATE
    SET nome = EXCLUDED.nome,
        tipo = EXCLUDED.tipo,
        ine  = EXCLUDED.ine;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'equipes', v_count);

  -- Etapa 2: profissionais. tb_cds_prof carrega nu_cns/nu_ine/nu_cbo_2002 diretamente (CBO real
  -- confirmado no formato "515105" para ACS, batendo com o prefixo '5151%' usado abaixo), mas
  -- NÃO tem o nome — o nome vem de tb_prof (join por nu_cns), priorizando nome social quando
  -- existir, como o restante do e-SUS faz.
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'profissionais', 0);

  INSERT INTO profissionais (id, equipe_id, nome, cns, cbo, eh_acs, ativo, fonte_id)
  SELECT
    gen_random_uuid(),
    eq.id,
    COALESCE(prof.no_social_profissional, prof.no_civil_profissional, cp.nu_cns),
    cp.nu_cns,
    cp.nu_cbo_2002,
    cp.nu_cbo_2002 LIKE '5151%', -- Agente Comunitário de Saúde
    true,
    cp.co_seq_cds_prof
  FROM esus.tb_cds_prof cp
  JOIN equipes eq ON eq.ine = cp.nu_ine
  LEFT JOIN esus.tb_prof prof ON prof.nu_cns = cp.nu_cns
  ON CONFLICT (fonte_id) DO UPDATE
    SET equipe_id = EXCLUDED.equipe_id,
        nome      = EXCLUDED.nome,
        cns       = EXCLUDED.cns,
        cbo       = EXCLUDED.cbo,
        eh_acs    = EXCLUDED.eh_acs;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'profissionais', v_count);

  -- Etapa 3: atendimentos (confirmado: usar o fato do data warehouse, não tb_atend_prof —
  -- tb_atend_prof só guarda os últimos ~2 dias e não resolve cidadão/tipo de demanda de forma
  -- confiável). f.nu_cns é o CNS do PROFISSIONAL executante (não do cidadão — esse é resolvido
  -- via co_fat_cidadao_pec), então dá para casar com profissionais.cns quando o profissional já
  -- foi sincronizado; f.co_dim_cbo_1 resolve o CBO com 100% de confiabilidade mesmo quando o
  -- CNS não casa com nenhum profissional local — usado pelo motor de C1-C7 (ver
  -- docs/indicadores-qualidade.md).
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'atendimentos', 0);

  INSERT INTO atendimentos (id, profissional_id, equipe_id, data_atendimento, tipo_atendimento, cbo, fonte_id)
  SELECT
    gen_random_uuid(),
    prof.id,
    eq.id,
    f.dt_inicial_atendimento::date,
    COALESCE(dta.ds_tipo_atendimento, 'Não informado'),
    dim_cbo.nu_cbo,
    f.co_seq_fat_atd_ind
  FROM esus.tb_fat_atendimento_individual f
  LEFT JOIN esus.tb_dim_tipo_atendimento dta ON dta.co_seq_dim_tipo_atendimento = f.co_dim_tipo_atendimento
  LEFT JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
  LEFT JOIN esus.tb_dim_cbo dim_cbo ON dim_cbo.co_seq_dim_cbo = f.co_dim_cbo_1
  LEFT JOIN profissionais prof ON prof.cns = f.nu_cns
  JOIN equipes eq ON eq.ine = dim_eq.nu_ine
  WHERE f.dt_inicial_atendimento >= now() - interval '2 days'
  ON CONFLICT (fonte_id) DO UPDATE
    SET profissional_id  = EXCLUDED.profissional_id,
        equipe_id        = EXCLUDED.equipe_id,
        data_atendimento = EXCLUDED.data_atendimento,
        tipo_atendimento = EXCLUDED.tipo_atendimento,
        cbo              = EXCLUDED.cbo;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'atendimentos', v_count);

  -- Etapa 4: cadastros individuais. tb_cds_cad_individual não tem equipe_id direto — resolve via
  -- co_cds_prof_cadastrante -> tb_cds_prof.nu_ine -> equipes.ine (mesmo profissional cadastrante).
  -- Nome do cidadão: tb_cds_cad_individual já traz no_cidadao/no_social_cidadao diretamente na
  -- própria linha (confirmado populado contra e-SUS real) — não precisa (nem dá: nu_cns_cidadao
  -- aqui costuma ser um hash de 32 caracteres, não o CNS de 15 dígitos de tb_cidadao.nu_cns, então
  -- um join por CNS não bate) de join com tb_cidadao. Nome social primeiro, como o e-SUS faz.
  --
  -- CNS real (cidadao_cns_real): resolvido separadamente via co_unico_ficha (GUID desta ficha de
  -- cadastro individual) == tb_cidadao.co_unico_ultima_ficha (GUID da última ficha que atualizou
  -- aquele cidadão) — confirmado batendo 100% (16/16) contra a instalação real, inclusive
  -- corretamente NULL para quem ainda não tem CNS validado. Também tenta co_unico_ficha_origem
  -- (ficha de origem, caso esta seja uma versão/correção) como segunda opção via LATERAL, que
  -- garante no máximo 1 linha por cadastro mesmo que os dois GUIDs batessem em pessoas diferentes.
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'cadastros_individuais', 0);

  -- fora_de_area vem direto de st_fora_area (real, sincronizado); beneficiario_bpc_pbf NÃO
  -- aparece aqui de propósito — é um campo manual (Nota Técnica 30, sem fonte no e-SUS) e nunca
  -- deve ser sobrescrito por uma sincronização.
  INSERT INTO cadastros_individuais (id, profissional_id, equipe_id, cidadao_cns, cidadao_cns_real, cidadao_nome, data_cadastro, fora_de_area, fonte_id)
  SELECT
    gen_random_uuid(),
    prof.id,
    prof.equipe_id,
    ci.nu_cns_cidadao,
    tc.nu_cns,
    COALESCE(NULLIF(ci.no_social_cidadao, ''), ci.no_cidadao),
    ci.dt_cad_individual::date,
    coalesce(ci.st_fora_area, 0) = 1,
    ci.co_seq_cds_cad_individual
  FROM esus.tb_cds_cad_individual ci
  JOIN esus.tb_cds_prof cp ON cp.co_seq_cds_prof = ci.co_cds_prof_cadastrante
  JOIN profissionais prof ON prof.fonte_id = cp.co_seq_cds_prof
  LEFT JOIN LATERAL (
    SELECT c.nu_cns
    FROM esus.tb_cidadao c
    WHERE c.co_unico_ultima_ficha = ci.co_unico_ficha
       OR c.co_unico_ultima_ficha = ci.co_unico_ficha_origem
    LIMIT 1
  ) tc ON true
  WHERE ci.nu_cns_cidadao IS NOT NULL
  ON CONFLICT (fonte_id) DO UPDATE
    SET profissional_id  = EXCLUDED.profissional_id,
        equipe_id        = EXCLUDED.equipe_id,
        cidadao_cns      = EXCLUDED.cidadao_cns,
        cidadao_cns_real = EXCLUDED.cidadao_cns_real,
        cidadao_nome     = EXCLUDED.cidadao_nome,
        data_cadastro    = EXCLUDED.data_cadastro,
        fora_de_area     = EXCLUDED.fora_de_area,
        atualizado_em    = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'cadastros_individuais', v_count);

  -- Etapa 5: cadastros domiciliares. Não existe uma coluna única "endereço de referência" no
  -- e-SUS — construída a partir de logradouro/número/complemento/bairro (confirmado via
  -- information_schema; tp_logradouro fica de fora por precisar de outro join de dimensão só
  -- para o prefixo "Rua"/"Av." etc., não essencial para exibição).
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'cadastros_domiciliares', 0);

  INSERT INTO cadastros_domiciliares (id, profissional_id, equipe_id, endereco_referencia, data_cadastro, fonte_id)
  SELECT
    gen_random_uuid(),
    prof.id,
    prof.equipe_id,
    trim(both ', ' FROM
      concat_ws(', ',
        NULLIF(trim(concat_ws(' ', cd.no_logradouro, cd.nu_domicilio)), ''),
        NULLIF(trim(cd.ds_complemento), ''),
        NULLIF(trim(cd.no_bairro), '')
      )
    ),
    cd.dt_cad_domiciliar::date,
    cd.co_seq_cds_cad_domiciliar
  FROM esus.tb_cds_cad_domiciliar cd
  JOIN esus.tb_cds_prof cp ON cp.co_seq_cds_prof = cd.co_cds_prof_cadastrante
  JOIN profissionais prof ON prof.fonte_id = cp.co_seq_cds_prof
  ON CONFLICT (fonte_id) DO UPDATE
    SET profissional_id      = EXCLUDED.profissional_id,
        equipe_id            = EXCLUDED.equipe_id,
        endereco_referencia  = EXCLUDED.endereco_referencia,
        data_cadastro        = EXCLUDED.data_cadastro,
        atualizado_em        = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'cadastros_domiciliares', v_count);

  -- Etapa 6: recalcula C1-C7/B1-B6/M1-M2 para o quadrimestre corrente. Bug real encontrado em
  -- 2026-09-13: nada disparava recalcular_indicadores_qualidade() automaticamente (só existia
  -- cron para sincronizar_esus, verificar_alertas e detectar_erros_*) — um atendimento novo
  -- sincronizava normalmente em `atendimentos`, mas o indicador de qualidade correspondente
  -- (ex.: C5/C6 para hipertensão/diabetes) nunca era recalculado, então o usuário nunca via a
  -- mudança refletida em Indicadores de Qualidade. recalcular_indicadores_qualidade() não faz
  -- COMMIT interno (cada calculadora também não), então é seguro chamar aqui dentro, antes do
  -- COMMIT final desta procedure.
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'indicadores_qualidade', 0);
  CALL recalcular_indicadores_qualidade(
    (CASE WHEN extract(month FROM now()) <= 4 THEN 'Q1' WHEN extract(month FROM now()) <= 8 THEN 'Q2' ELSE 'Q3' END)::"Quadrimestre",
    extract(year FROM now())::int
  );

  -- Etapa 7: recalcula o componente Vínculo e Acompanhamento Territorial (Nota Técnica 30).
  -- Diferente de recalcular_indicadores_qualidade(), calcular_vinculo_acompanhamento() não tem
  -- proteção interna por calculadora — por isso o BEGIN/EXCEPTION aqui, pra uma falha nele (ex.:
  -- população do município ainda não configurada) nunca quebrar a sincronização do e-SUS em si.
  CALL sp_atualizar_progresso(p_sincronizacao_id, 'vinculo_acompanhamento', 0);
  BEGIN
    CALL calcular_vinculo_acompanhamento(
      (CASE WHEN extract(month FROM now()) <= 4 THEN 'Q1' WHEN extract(month FROM now()) <= 8 THEN 'Q2' ELSE 'Q3' END)::"Quadrimestre",
      extract(year FROM now())::int
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'sincronizar_esus: falha em calcular_vinculo_acompanhamento — %', SQLERRM;
  END;

  UPDATE sincronizacoes
     SET status = 'concluida',
         etapa_atual = 'concluido',
         concluido_em = now()
   WHERE id = p_sincronizacao_id;
  COMMIT;
END;
$$;
-- Sem bloco EXCEPTION de propósito: um handler EXCEPTION cria uma subtransação implícita que
-- envolve TODO o corpo da procedure (não só o que vem depois dele), e uma procedure chamada de
-- dentro de uma subtransação não pode fazer COMMIT — quebraria os commits incrementais de
-- sp_atualizar_progresso já na primeira etapa. Por isso quem chama (route.ts para sincronização
-- manual; a própria falha do job para a automática, visível em cron.job_run_details) é
-- responsável por marcar status = 'erro' em sincronizacoes se o CALL lançar exceção.
