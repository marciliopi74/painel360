-- Detecção automática de erros em cadastros (requisito 11). A sugestão de solução para cada
-- tipo_erro (requisito 12) fica no lado da aplicação, em src/lib/data/cadastros.ts
-- (SUGESTOES_ERRO), para poder ser exibida/traduzida sem precisar reaplicar SQL.

CREATE OR REPLACE FUNCTION detectar_erros_cadastros() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- cadastros individuais
  --
  -- Bug real corrigido em 2026-09-13 (reportado pelo usuário: nenhum cadastro individual "sem
  -- erro" aparecia na tela de Cadastros — só domiciliares): esta checagem validava
  -- cidadao_cns como se fosse sempre um CNS real de 15 dígitos, mas nesta instalação
  -- tb_cds_cad_individual.nu_cns_cidadao vem preenchido com um HASH de 32 caracteres hex (ver
  -- comentário em CadastroIndividual no schema.prisma e em sql/03_sync_functions.sql) — ou seja,
  -- depois de tirar os não-dígitos, NUNCA dava exatamente 15, e os 15 cadastros individuais reais
  -- desta instalação ficavam 100% flagados como cns_invalido, sempre. Corrigido para aceitar os
  -- dois formatos observados na prática (CNS real de 15 dígitos OU o hash de 32 caracteres desta
  -- instalação) — só sinaliza erro quando está preenchido mas não bate com nenhum dos dois.
  --
  -- Bug real corrigido em 2026-09-14 (reportado pelo usuário: cadastro feito com CPF não aparecia
  -- em Cadastros): cidadao_cns virou nullable — um cidadão pode legitimamente não ter CNS ainda
  -- (só CPF, ver sql/03_sync_functions.sql). cidadao_cns IS NULL sozinho NÃO é mais erro (antes
  -- era, e teria reintroduzido o mesmo falso-positivo em massa do bug de 2026-09-13 assim que
  -- esses cadastros passassem a ser sincronizados) — só é erro quando preenchido e mal-formado.
  UPDATE cadastros_individuais
     SET tem_erro = true,
         tipo_erro = 'cns_invalido'
   WHERE tem_erro IS DISTINCT FROM true
     AND cidadao_cns IS NOT NULL
     AND NOT (cidadao_cns ~ '^[0-9]{15}$' OR cidadao_cns ~ '^[0-9a-f]{32}$');

  -- reverte cadastros que foram flagados cns_invalido antes desta correção mas que, pelo
  -- critério novo, são válidos (hash de 32 caracteres) — sem isso continuariam presos com
  -- tem_erro=true indefinidamente, já que a checagem acima só ADICIONA a flag, nunca remove.
  UPDATE cadastros_individuais
     SET tem_erro = false, tipo_erro = NULL
   WHERE tipo_erro = 'cns_invalido'
     AND (cidadao_cns ~ '^[0-9]{15}$' OR cidadao_cns ~ '^[0-9a-f]{32}$');

  UPDATE cadastros_individuais
     SET tem_erro = true,
         tipo_erro = 'data_futura'
   WHERE (tipo_erro IS NULL OR tipo_erro <> 'cns_invalido')
     AND data_cadastro > current_date;

  -- Duplicados (requisito pedido pelo usuário 2026-09-14): ACS frequentemente cadastram a mesma
  -- pessoa mais de uma vez no e-SUS — às vezes com o MESMO identificador (2 fichas com o mesmo
  -- CNS), às vezes com identificadores DIFERENTES (uma ficha só com CPF, outra só com Cartão
  -- SUS/DNV pra a mesma pessoa). Limpa as duas flags antes de recalcular, senão um cadastro que
  -- deixou de ser duplicado (ex.: um dos registros foi desativado no e-SUS) ficaria preso com a
  -- flag pra sempre — as checagens abaixo só ADICIONAM a flag a quem ainda é duplicado agora.
  UPDATE cadastros_individuais
     SET tem_erro = false, tipo_erro = NULL
   WHERE tipo_erro IN ('duplicado', 'duplicado_provavel');

  -- duplicado exato: mesmo CNS, CPF ou DNV usado em mais de uma ficha — checado no MUNICÍPIO
  -- INTEIRO, não só dentro da mesma equipe (pedido explícito do usuário 2026-09-14: pessoa
  -- recadastrada por outra equipe, ex. mudança de área, sem desativar o registro antigo — mesmo
  -- identificador em 2 equipes diferentes é ainda mais claramente um erro/duplicidade do que
  -- dentro da mesma equipe). Checado independentemente por coluna — mesmo CNS já basta, não
  -- precisa também bater CPF/DNV.
  WITH duplicados AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY cidadao_cns ORDER BY atualizado_em DESC) AS rn
      FROM cadastros_individuais WHERE cidadao_cns IS NOT NULL
    ) t WHERE rn > 1
    UNION
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY cidadao_cpf ORDER BY atualizado_em DESC) AS rn
      FROM cadastros_individuais WHERE cidadao_cpf IS NOT NULL
    ) t WHERE rn > 1
    UNION
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY cidadao_dnv ORDER BY atualizado_em DESC) AS rn
      FROM cadastros_individuais WHERE cidadao_dnv IS NOT NULL
    ) t WHERE rn > 1
  )
  UPDATE cadastros_individuais ci
     SET tem_erro = true,
         tipo_erro = 'duplicado'
    FROM duplicados d
   WHERE ci.id = d.id
     AND (ci.tipo_erro IS NULL OR ci.tipo_erro NOT IN ('cns_invalido', 'data_futura'));

  -- duplicado provável: mesmo nome no MUNICÍPIO INTEIRO (não só na mesma equipe — mesmo motivo do
  -- exato acima), mas SEM nenhum identificador em comum (senão já teria caído no exato acima) — o
  -- caso relatado pelo usuário, uma ficha só com CPF e outra só com Cartão SUS/DNV pra mesma
  -- pessoa, possivelmente em equipes/microáreas diferentes. É uma HEURÍSTICA por nome, não uma
  -- certeza (nomes iguais também podem ser pessoas diferentes) — por isso um tipo_erro separado,
  -- nunca fundido automaticamente; o texto de sugestão (SUGESTOES_ERRO) deixa essa ressalva
  -- explícita. A tela mostra equipe/INE/microárea de cada registro encontrado só pra quem pode
  -- ver todas as equipes (gestor_local) — ver obterAtualizacaoCadastroIndividual em
  -- src/lib/data/cidadao.ts.
  WITH duplicados_nome AS (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY upper(cidadao_nome) ORDER BY atualizado_em DESC) AS rn
      FROM cadastros_individuais
      WHERE cidadao_nome IS NOT NULL AND trim(cidadao_nome) <> ''
    ) t WHERE rn > 1
  )
  UPDATE cadastros_individuais ci
     SET tem_erro = true,
         tipo_erro = 'duplicado_provavel'
    FROM duplicados_nome d
   WHERE ci.id = d.id
     AND (ci.tipo_erro IS NULL OR ci.tipo_erro NOT IN ('cns_invalido', 'data_futura', 'duplicado'));

  UPDATE cadastros_individuais
     SET tem_erro = false, tipo_erro = NULL
   WHERE tem_erro = true
     AND tipo_erro NOT IN ('cns_invalido', 'data_futura', 'duplicado', 'duplicado_provavel');

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
