-- Detecção automática de erros em cadastros (requisito 11). A sugestão de solução para cada
-- tipo_erro (requisito 12) fica no lado da aplicação, em src/lib/data/cadastros.ts
-- (SUGESTOES_ERRO), para poder ser exibida/traduzida sem precisar reaplicar SQL.

CREATE OR REPLACE FUNCTION detectar_erros_cadastros() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- cadastros individuais
  UPDATE cadastros_individuais
     SET tem_erro = true,
         tipo_erro = 'cns_invalido'
   WHERE tem_erro IS DISTINCT FROM true
     AND (cidadao_cns IS NULL OR length(regexp_replace(cidadao_cns, '\D', '', 'g')) <> 15);

  UPDATE cadastros_individuais
     SET tem_erro = true,
         tipo_erro = 'data_futura'
   WHERE (tipo_erro IS NULL OR tipo_erro <> 'cns_invalido')
     AND data_cadastro > current_date;

  WITH duplicados AS (
    SELECT id
    FROM (
      SELECT id, row_number() OVER (PARTITION BY equipe_id, cidadao_cns ORDER BY atualizado_em DESC) AS rn
      FROM cadastros_individuais
      WHERE cidadao_cns IS NOT NULL
    ) t
    WHERE rn > 1
  )
  UPDATE cadastros_individuais ci
     SET tem_erro = true,
         tipo_erro = 'duplicado'
    FROM duplicados d
   WHERE ci.id = d.id
     AND (ci.tipo_erro IS NULL OR ci.tipo_erro NOT IN ('cns_invalido', 'data_futura'));

  UPDATE cadastros_individuais
     SET tem_erro = false, tipo_erro = NULL
   WHERE tem_erro = true
     AND tipo_erro NOT IN ('cns_invalido', 'data_futura', 'duplicado');

  -- cadastros domiciliares
  UPDATE cadastros_domiciliares
     SET tem_erro = true,
         tipo_erro = 'endereco_incompleto'
   WHERE tem_erro IS DISTINCT FROM true
     AND (endereco_referencia IS NULL OR length(trim(endereco_referencia)) < 5);

  UPDATE cadastros_domiciliares
     SET tem_erro = true,
         tipo_erro = 'data_futura'
   WHERE (tipo_erro IS NULL OR tipo_erro <> 'endereco_incompleto')
     AND data_cadastro > current_date;

  UPDATE cadastros_domiciliares
     SET tem_erro = false, tipo_erro = NULL
   WHERE tem_erro = true
     AND tipo_erro NOT IN ('endereco_incompleto', 'data_futura');
END;
$$;

SELECT cron.schedule('detectar-erros-cadastros', '*/15 * * * *', $$ SELECT detectar_erros_cadastros(); $$);

-- requisito 15: detecção automática de erros em atendimentos.
CREATE OR REPLACE FUNCTION detectar_erros_atendimentos() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE atendimentos
     SET tem_erro = true,
         tipo_erro = 'tipo_nao_informado'
   WHERE tem_erro IS DISTINCT FROM true
     AND (tipo_atendimento IS NULL OR tipo_atendimento = '' OR tipo_atendimento = 'Não informado');

  UPDATE atendimentos
     SET tem_erro = true,
         tipo_erro = 'data_futura'
   WHERE (tipo_erro IS NULL OR tipo_erro <> 'tipo_nao_informado')
     AND data_atendimento > current_date;

  UPDATE atendimentos
     SET tem_erro = false, tipo_erro = NULL
   WHERE tem_erro = true
     AND tipo_erro NOT IN ('tipo_nao_informado', 'data_futura');
END;
$$;

SELECT cron.schedule('detectar-erros-atendimentos', '*/15 * * * *', $$ SELECT detectar_erros_atendimentos(); $$);
