-- Configura o Foreign Data Wrapper para o PostgreSQL do e-SUS AB PEC (requisito 5).
-- Placeholders ${ESUS_FDW_*} são substituídos pelo scripts/apply-sql.ts a partir do ambiente
-- antes deste arquivo ser executado. Reexecutável: recria o server/mapeamento do zero.

DROP SERVER IF EXISTS esus_server CASCADE;

CREATE SERVER esus_server
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (host '${ESUS_FDW_HOST}', port '${ESUS_FDW_PORT}', dbname '${ESUS_FDW_DBNAME}');

CREATE USER MAPPING FOR CURRENT_USER
  SERVER esus_server
  OPTIONS (user '${ESUS_FDW_USER}', password '${ESUS_FDW_PASSWORD}');

CREATE SCHEMA IF NOT EXISTS esus;

-- Importa apenas as tabelas realmente usadas pela sincronização e pelo motor de cálculo dos
-- Indicadores de Qualidade. Nomes/colunas de tabelas do e-SUS variam entre versões e
-- customizações municipais — revalidar contra a base real antes de confiar cegamente nesta
-- lista (ver docs/esus-fdw.md). Tabelas inexistentes no remoto são ignoradas silenciosamente
-- pelo IMPORT FOREIGN SCHEMA ... LIMIT TO, então esta lista é uma tentativa ampla e segura.
IMPORT FOREIGN SCHEMA public LIMIT TO (
  -- cadastros / equipes / profissionais (operacional, CDS)
  tb_cds_cad_individual,
  tb_cds_cad_domiciliar,
  tb_cds_prof,
  tb_prof,
  tb_equipe,
  tb_tipo_equipe,
  tb_lotacao,
  tb_atend_prof,
  tb_tipo_atend_prof,
  -- cidadão (joins de população / drill-down)
  tb_cidadao,
  tb_cidadao_vinculacao_equipe,
  tb_prontuario,
  tb_problema,
  tb_pre_natal,
  -- data warehouse (Indicadores de Qualidade: C1-C7 / B1-B6 / M1-M2)
  tb_fat_atendimento_individual,
  tb_fat_atd_ind_problemas,
  tb_fat_atd_ind_procedimentos,
  tb_fat_vacinacao,
  tb_fat_vacinacao_vacina,
  tb_fat_visita_domiciliar,
  tb_fat_atendimento_odonto,
  tb_fat_atend_odonto_proced,
  tb_fat_atvdd_coletiva_part,
  tb_fat_atividade_coletiva,
  tb_fat_cuidado_compartilhado,
  tb_dim_cbo,
  tb_dim_equipe,
  tb_dim_sexo,
  tb_dim_identidade_genero,
  tb_dim_situacao_problema,
  tb_dim_procedimento,
  tb_dim_ciap,
  tb_cid10,
  tb_dim_tipo_atendimento,
  tb_dim_tipo_consulta_odonto,
  tb_dim_tipo_atividade,
  tb_dim_imunobiologico,
  tb_dim_tempo
) FROM SERVER esus_server INTO esus;
