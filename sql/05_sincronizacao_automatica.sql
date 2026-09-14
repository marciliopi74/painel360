-- Disparo de sincronização automática (requisito 6).
-- A funcionalidade de Alertas por SMS (requisitos 24-25) e a tabela `alertas` foram removidas do
-- sistema (2026-09-14) — este arquivo se chamava 05_alertas_relatorios.sql antes disso.

-- Usuário de sistema (necessário porque sincronizacoes.disparada_por é NOT NULL) — criado pelo
-- prisma/seed.ts com este mesmo UUID fixo.
--
-- PROCEDURE, não FUNCTION: sincronizar_esus faz COMMIT interno (progresso incremental), e o
-- Postgres só permite controle de transação em CALLs encadeados de procedure para procedure —
-- dentro de uma FUNCTION o COMMIT falharia com "invalid transaction termination".
-- DROP explícito porque CREATE OR REPLACE não troca o tipo de rotina (function -> procedure).
-- DROP ROUTINE (não DROP FUNCTION) para ser idempotente mesmo depois de já ter virado procedure.
DROP ROUTINE IF EXISTS disparar_sincronizacao_automatica();
CREATE OR REPLACE PROCEDURE disparar_sincronizacao_automatica() LANGUAGE plpgsql AS $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO sincronizacoes (id, disparada_por, tipo, status, iniciado_em)
  VALUES (v_id, '00000000-0000-0000-0000-000000000001', 'automatica', 'em_andamento', now());

  CALL sincronizar_esus(v_id);
END;
$$;

-- requisito 6: tabelas materializadas atualizadas a cada 5-15 minutos.
SELECT cron.schedule('sincronizacao-automatica-esus', '*/10 * * * *',
  $$ CALL disparar_sincronizacao_automatica(); $$);

-- Limpeza única (idempotente) do job de cron da funcionalidade de Alertas removida — sem isso, uma
-- instalação que já tinha esse job agendado (via cron.schedule, que só faz upsert) ficaria com ele
-- rodando pra sempre, chamando uma função verificar_alertas() que não existe mais.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'verificar-alertas-qualidade') THEN
    PERFORM cron.unschedule('verificar-alertas-qualidade');
  END IF;
END;
$$;

-- DROP explícito: os arquivos em sql/ só fazem CREATE OR REPLACE, nunca DROP — remover a
-- definição deste arquivo não apaga a função já criada em instalações existentes.
DROP FUNCTION IF EXISTS verificar_alertas("Quadrimestre", int);
