-- Extensões necessárias no banco da aplicação.
-- postgres_fdw: acesso somente-leitura ao PostgreSQL do e-SUS (requisito 5).
-- pg_cron: agendamento de refresh das tabelas materializadas e geração de relatórios (requisito 6, 22, 23).
CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()
