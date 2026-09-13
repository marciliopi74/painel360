-- Alertas (requisitos 24-25) e disparo de sincronização automática (requisito 6).
-- Geração de relatórios (requisitos 22-23) fica no lado da aplicação (scripts/gerar-relatorio.ts),
-- pois envolve renderizar um arquivo (PDF/HTML) e gravar relatorios_gerados.arquivo_url — o Postgres
-- só é usado aqui para popular alertas; o envio de SMS em si é feito pela aplicação Node (único
-- ponto de acesso à internet do sistema, ver requisito 28), que faz polling de alertas com
-- enviado_sms = false.

CREATE OR REPLACE FUNCTION verificar_alertas(p_quadrimestre "Quadrimestre", p_ano int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  v_criados int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT ri.equipe_id, ri.indicador_id, ic.nome AS indicador_nome, ri.valor_calculado, ri.classificacao,
           p.id AS profissional_id
    FROM resultados_indicadores ri
    JOIN indicadores_catalogo ic ON ic.id = ri.indicador_id
    JOIN profissionais p ON p.equipe_id = ri.equipe_id AND p.ativo
    WHERE ri.quadrimestre = p_quadrimestre
      AND ri.ano = p_ano
      -- requisito 24: classificado como "Regular" OU abaixo do mínimo esperado (parâmetro suficiente)
      AND (
        ri.classificacao = 'regular'
        OR (ic.polaridade = 'maior_melhor' AND ic.parametro_suficiente_min IS NOT NULL AND ri.valor_calculado < ic.parametro_suficiente_min)
        OR (ic.polaridade = 'menor_melhor' AND ic.parametro_suficiente_max IS NOT NULL AND ri.valor_calculado > ic.parametro_suficiente_max)
      )
      AND NOT EXISTS (
        SELECT 1 FROM alertas al
        WHERE al.profissional_id = p.id
          AND al.indicador_id = ri.indicador_id
          AND al.criado_em >= now() - interval '1 day' * 130 -- não duplicar dentro do mesmo quadrimestre (~130 dias)
      )
  LOOP
    INSERT INTO alertas (id, profissional_id, indicador_id, mensagem, enviado_sms, criado_em)
    VALUES (
      gen_random_uuid(), r.profissional_id, r.indicador_id,
      -- format() do Postgres só suporta %s/%I/%L/%% — não aceita especificadores estilo C como
      -- %.2f (bug real: toda vez que esta linha rodava com uma vírgula/valor casando, a função
      -- inteira lançava "unrecognized format() type specifier" e abortava, então nenhum alerta
      -- de indicador jamais foi criado até este fix, 2026-09-13).
      format('Indicador %s ficou classificado como %s (%s) em %s/%s.',
             r.indicador_nome, r.classificacao, round(r.valor_calculado, 2), p_quadrimestre, p_ano),
      false, now()
    );
    v_criados := v_criados + 1;
  END LOOP;

  RETURN v_criados;
END;
$$;

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

-- requisito 24: verifica alertas para o quadrimestre corrente, a cada hora.
SELECT cron.schedule('verificar-alertas-qualidade', '0 * * * *', $$
  SELECT verificar_alertas(
    (CASE WHEN extract(month FROM now()) <= 4 THEN 'Q1' WHEN extract(month FROM now()) <= 8 THEN 'Q2' ELSE 'Q3' END)::"Quadrimestre",
    extract(year FROM now())::int
  );
$$);
