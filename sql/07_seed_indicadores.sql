-- Catálogo dos Indicadores de Qualidade (requisitos 16-19).
--
-- C1-C7: bandas de classificação e metadados vêm das Notas Metodológicas oficiais (Ministério
-- da Saúde/SAPS, saude.gov.br, obtidas e conferidas em 2026-09-12 — documentos assinados
-- eletronicamente em jun/2026). C1 é o único com polaridade "neutra" (Regular tanto abaixo do
-- mínimo quanto acima do máximo — ver a Nota C1, item 30).
--
-- B1-B6 (eSB) e M1-M2 (eMulti): Notas Metodológicas não foram buscadas nesta sessão — sem
-- bandas, propositalmente (ver docs/indicadores-qualidade.md e o aviso original abaixo).
--
-- formula_numerador/formula_denominador (2026-09-13): descrição textual do que cada resultado
-- conta, no formato padronizado das Notas Metodológicas oficiais (bloco "Fórmula de Cálculo").
-- Texto derivado diretamente da lógica já implementada em calcular_c1..c7/b1..b6/m1..m2 (sql/04,
-- 08, 09, 10), que por sua vez já reflete as Notas oficiais — nenhuma metodologia nova aqui, só a
-- descrição em prosa do que o SQL já calcula.
INSERT INTO indicadores_catalogo
  (id, codigo, nome, tipo_equipe_alvo, categoria, unidade_medida, polaridade,
   parametro_otimo_min, parametro_otimo_max, parametro_bom_min, parametro_bom_max,
   parametro_suficiente_min, parametro_suficiente_max, formula_numerador, formula_denominador,
   ano_referencia)
VALUES
  (gen_random_uuid(), 'C1', 'Mais Acesso à Atenção Primária à Saúde (APS)', 'ESF_EAP', 'indicador_proporcional', 'percentual', 'neutra',
   50, 70, 30, 50, 10, 30,
   'Nº total de atendimentos por demanda programada (consulta agendada programada/cuidado continuado; e consulta agendada).',
   'Nº total de atendimentos por todos os tipos de demanda (programada e espontânea: consulta agendada programada/cuidado continuado, consulta agendada, escuta inicial/orientação, consulta no dia e atendimento de urgência).',
   2024),
  (gen_random_uuid(), 'C2', 'Cuidado no desenvolvimento infantil', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma dos pontos obtidos por cada criança de até 2 anos vinculada à equipe, conforme os 5 critérios do Quadro de Boas Práticas (20 pontos cada: 1ª consulta até o 30º dia de vida; ≥9 consultas até 2 anos; ≥9 registros simultâneos de peso e altura; ≥2 visitas domiciliares de ACS/TACS; esquema vacinal completo).',
   'Nº de crianças de até 2 anos vinculadas à equipe, multiplicado por 100 (pontuação máxima possível por criança).',
   2024),
  (gen_random_uuid(), 'C3', 'Cuidado na gestação e puerpério', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma dos pontos obtidos por cada gestante/puérpera elegível, conforme os 11 critérios do Quadro de Boas Práticas (1ª consulta até a 12ª semana; ≥7 consultas; ≥7 aferições de pressão arterial; ≥7 registros de peso e altura; ≥3 visitas domiciliares; vacina dTpa; exames de sífilis/HIV/hepatites no 1º e 3º trimestres; consulta e visita domiciliar no puerpério; atividade de saúde bucal).',
   'Nº de gestantes/puérperas elegíveis vinculadas à equipe, multiplicado por 100.',
   2024),
  (gen_random_uuid(), 'C4', 'Cuidado da pessoa com diabetes', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma dos pontos obtidos por cada pessoa com diabetes vinculada, conforme os 6 critérios do Quadro de Boas Práticas (consulta e aferição de pressão arterial nos últimos 6 meses; registro de peso/altura, visitas domiciliares, hemoglobina glicada e avaliação dos pés nos últimos 12 meses).',
   'Nº de pessoas com diabetes (CID-10/CIAP-2 ativo) vinculadas à equipe, multiplicado por 100.',
   2024),
  (gen_random_uuid(), 'C5', 'Cuidado da pessoa com hipertensão', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma dos pontos obtidos por cada pessoa com hipertensão vinculada, conforme os 4 critérios do Quadro de Boas Práticas (consulta e aferição de pressão arterial nos últimos 6 meses; registro de peso/altura e visitas domiciliares nos últimos 12 meses).',
   'Nº de pessoas com hipertensão (CID-10/CIAP-2 ativo) vinculadas à equipe, multiplicado por 100.',
   2024),
  (gen_random_uuid(), 'C6', 'Cuidado da pessoa idosa', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma dos pontos obtidos por cada pessoa idosa (60 anos ou mais) vinculada, conforme os 4 critérios do Quadro de Boas Práticas (consulta, registro de peso/altura e visitas domiciliares nos últimos 12 meses; dose de vacina influenza nos últimos 12 meses).',
   'Nº de pessoas idosas (60 anos ou mais) vinculadas à equipe, multiplicado por 100.',
   2024),
  (gen_random_uuid(), 'C7', 'Cuidado da mulher e do homem transgênero na prevenção do câncer', 'ESF_EAP', 'boa_pratica_pontuada', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Soma ponderada de 4 sub-indicadores, cada um calculado sobre sua própria população elegível: rastreamento de câncer de colo do útero em mulheres/homens trans de 25-64 anos (peso 20); dose de vacina HPV em meninas de 9-14 anos (peso 30); atendimento em saúde sexual e reprodutiva de 14-69 anos (peso 30); rastreamento de câncer de mama de 50-69 anos (peso 20).',
   '100 (soma fixa dos pesos dos 4 sub-indicadores: 20+30+30+20).',
   2024)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      polaridade = EXCLUDED.polaridade,
      parametro_otimo_min = EXCLUDED.parametro_otimo_min,
      parametro_otimo_max = EXCLUDED.parametro_otimo_max,
      parametro_bom_min = EXCLUDED.parametro_bom_min,
      parametro_bom_max = EXCLUDED.parametro_bom_max,
      parametro_suficiente_min = EXCLUDED.parametro_suficiente_min,
      parametro_suficiente_max = EXCLUDED.parametro_suficiente_max,
      formula_numerador = EXCLUDED.formula_numerador,
      formula_denominador = EXCLUDED.formula_denominador;

-- B1-B6: Notas Metodológicas oficiais (fornecidas localmente pelo usuário, assinadas
-- eletronicamente em 12-13/05/2026). B1/B4 são razões brutas (ver sql/09_indicadores_b1_b6.sql,
-- nota 1) — bandas na escala 0-N, não 0-100. B3/B5 usam polaridade 'neutra' (Regular nas duas
-- pontas, ver nota 2 no mesmo arquivo), embora a nota rotule "menor-melhor"/"maior-melhor".
INSERT INTO indicadores_catalogo
  (id, codigo, nome, tipo_equipe_alvo, categoria, unidade_medida, polaridade,
   parametro_otimo_min, parametro_otimo_max, parametro_bom_min, parametro_bom_max,
   parametro_suficiente_min, parametro_suficiente_max, formula_numerador, formula_denominador,
   ano_referencia)
VALUES
  (gen_random_uuid(), 'B1', 'Primeira consulta odontológica programada', 'ESB', 'indicador_proporcional', 'percentual', 'maior_melhor',
   1.25, 999, 0.75, 1.25, 0.25, 0.75,
   'Nº de pessoas distintas com primeira consulta odontológica programada registrada na eSB no período.',
   'População vinculada à equipe de referência (eSF/eAP), dividida entre as eSB vinculadas na proporção da carga horária semanal de cada uma (ex.: 2 eSB de 20h dividem a população de 1 eSF de 40h).',
   2024),
  (gen_random_uuid(), 'B2', 'Tratamento odontológico concluído', 'ESB', 'indicador_proporcional', 'percentual', 'maior_melhor',
   75, 100, 50, 75, 25, 50,
   'Nº de pessoas distintas com tratamento odontológico concluído no período.',
   'Nº de pessoas distintas com primeira consulta odontológica programada no mesmo período.',
   2024),
  (gen_random_uuid(), 'B3', 'Taxa de exodontia', 'ESB', 'indicador_proporcional', 'percentual', 'neutra',
   3, 10, 10, 12, 12, 14,
   'Nº de procedimentos de exodontia (extração dentária) realizados pela eSB no período.',
   'Nº total de procedimentos odontológicos realizados pela eSB no período.',
   2024),
  (gen_random_uuid(), 'B4', 'Escovação dental supervisionada (6-12 anos)', 'ESB', 'indicador_proporcional', 'percentual', 'maior_melhor',
   1, 999, 0.5, 1, 0.25, 0.5,
   'Nº de crianças de 6 a 12 anos participantes de ação coletiva de escovação dental supervisionada no período.',
   'População de 6 a 12 anos vinculada à equipe de referência (eSF/eAP), dividida entre as eSB vinculadas na proporção da carga horária semanal de cada uma.',
   2024),
  (gen_random_uuid(), 'B5', 'Procedimentos odontológicos preventivos', 'ESB', 'indicador_proporcional', 'percentual', 'neutra',
   65, 85, 55, 65, 40, 55,
   'Nº de procedimentos odontológicos preventivos (ex.: aplicação tópica de flúor, selante, escovação supervisionada individual) realizados pela eSB no período.',
   'Nº total de procedimentos odontológicos realizados pela eSB no período.',
   2024),
  (gen_random_uuid(), 'B6', 'Tratamento Restaurador Atraumático (ART)', 'ESB', 'indicador_proporcional', 'percentual', 'maior_melhor',
   8, 100, 6, 8, 3, 6,
   'Nº de procedimentos de Tratamento Restaurador Atraumático (ART) realizados pela eSB no período.',
   'Nº total de procedimentos restauradores realizados pela eSB no período.',
   2024)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      polaridade = EXCLUDED.polaridade,
      parametro_otimo_min = EXCLUDED.parametro_otimo_min,
      parametro_otimo_max = EXCLUDED.parametro_otimo_max,
      parametro_bom_min = EXCLUDED.parametro_bom_min,
      parametro_bom_max = EXCLUDED.parametro_bom_max,
      parametro_suficiente_min = EXCLUDED.parametro_suficiente_min,
      parametro_suficiente_max = EXCLUDED.parametro_suficiente_max,
      formula_numerador = EXCLUDED.formula_numerador,
      formula_denominador = EXCLUDED.formula_denominador;

-- M1-M2 (eMulti): Notas Metodológicas oficiais (Notas Técnicas 43 e 44/2026-CGIAD), fornecidas
-- localmente pelo usuário. M1 é razão bruta (média), como B1/B4 — sem multiplicar por 100 (ver
-- sql/10_indicadores_m1_m2.sql). M2 é rotulada "polaridade: Neutra" na nota mas as bandas não
-- têm teto (só "Ótimo: > 5"), então funciona como maior_melhor de fato — sem inconsistência de
-- classificação como em C1/B3/B5.
INSERT INTO indicadores_catalogo
  (id, codigo, nome, tipo_equipe_alvo, categoria, unidade_medida, polaridade,
   parametro_otimo_min, parametro_bom_min, parametro_bom_max, parametro_suficiente_min, parametro_suficiente_max,
   formula_numerador, formula_denominador, ano_referencia)
VALUES
  (gen_random_uuid(), 'M1', 'Média de atendimentos por pessoa (eMulti)', 'EMULTI', 'indicador_media', 'media', 'maior_melhor',
   3, 2, 3, 1, 2,
   'Nº de atendimentos individuais somado às participações em atividade coletiva realizados pela eMulti no período.',
   'Nº de pessoas distintas atendidas (individualmente ou em atividade coletiva) pela eMulti no período.',
   2024),
  (gen_random_uuid(), 'M2', 'Ações interprofissionais realizadas pela eMulti', 'EMULTI', 'indicador_proporcional', 'percentual', 'maior_melhor',
   5, 2.5, 5, 1, 2.5,
   'Nº de atendimentos individuais com 2º profissional registrado (CBO eMulti em pelo menos um dos dois) somado aos registros do Módulo de Compartilhamento do Cuidado do e-SUS PEC.',
   'Nº total de ações da eMulti no período (atendimentos individuais + atividades coletivas + registros de cuidado compartilhado).',
   2024)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome,
      polaridade = EXCLUDED.polaridade,
      parametro_otimo_min = EXCLUDED.parametro_otimo_min,
      parametro_bom_min = EXCLUDED.parametro_bom_min,
      parametro_bom_max = EXCLUDED.parametro_bom_max,
      parametro_suficiente_min = EXCLUDED.parametro_suficiente_min,
      parametro_suficiente_max = EXCLUDED.parametro_suficiente_max,
      formula_numerador = EXCLUDED.formula_numerador,
      formula_denominador = EXCLUDED.formula_denominador;

-- Critérios (boas práticas) de C2-C7, com os pontos exatos das Notas Metodológicas oficiais
-- (Quadro 01 de cada nota). Usados por sql/08_indicadores_c2_c7.sql tanto para o cálculo quanto
-- para o drill-down por pessoa (requisito 21).
INSERT INTO boas_praticas_criterios (id, indicador_id, codigo_criterio, descricao, pontos)
SELECT gen_random_uuid(), ic.id, x.codigo, x.descricao, x.pontos
FROM (VALUES
  ('C2', 'A', '1ª consulta presencial até o 30º dia de vida (médico/enfermeiro)', 20),
  ('C2', 'B', 'Pelo menos 9 consultas presenciais/remotas até 2 anos (médico/enfermeiro)', 20),
  ('C2', 'C', 'Pelo menos 9 registros simultâneos de peso e altura até 2 anos', 20),
  ('C2', 'D', 'Pelo menos 2 visitas domiciliares de ACS/TACS (1ª até 30 dias, 2ª até 6 meses)', 20),
  ('C2', 'E', 'Esquema vacinal completo (penta, VIP, SCR, pneumocócica)', 20),

  ('C3', 'A', '1ª consulta até a 12ª semana de gestação (médico/enfermeiro)', 10),
  ('C3', 'B', 'Pelo menos 7 consultas durante a gestação (médico/enfermeiro)', 9),
  ('C3', 'C', 'Pelo menos 7 aferições de pressão arterial durante a gestação', 9),
  ('C3', 'D', 'Pelo menos 7 registros simultâneos de peso e altura durante a gestação', 9),
  ('C3', 'E', 'Pelo menos 3 visitas domiciliares de ACS/TACS após a 1ª consulta de pré-natal', 9),
  ('C3', 'F', 'Vacina dTpa a partir da 20ª semana de gestação', 9),
  ('C3', 'G', 'Testes/exames sífilis, HIV, hepatites B e C no 1º trimestre', 9),
  ('C3', 'H', 'Testes/exames sífilis e HIV no 3º trimestre', 9),
  ('C3', 'I', 'Pelo menos 1 consulta puerperal (médico/enfermeiro)', 9),
  ('C3', 'J', 'Pelo menos 1 visita domiciliar de ACS/TACS no puerpério', 9),
  ('C3', 'K', 'Pelo menos 1 atividade de saúde bucal durante a gestação', 9),

  ('C4', 'A', 'Pelo menos 1 consulta nos últimos 6 meses (médico/enfermeiro)', 20),
  ('C4', 'B', 'Pelo menos 1 aferição de pressão arterial nos últimos 6 meses', 15),
  ('C4', 'C', 'Pelo menos 1 registro de peso e altura nos últimos 12 meses', 15),
  ('C4', 'D', 'Pelo menos 2 visitas domiciliares de ACS/TACS (intervalo mín. 30 dias) nos últimos 12 meses', 20),
  ('C4', 'E', 'Pelo menos 1 hemoglobina glicada solicitada/avaliada nos últimos 12 meses', 15),
  ('C4', 'F', 'Pelo menos 1 avaliação dos pés nos últimos 12 meses', 15),

  ('C5', 'A', 'Pelo menos 1 consulta nos últimos 6 meses (médico/enfermeiro)', 25),
  ('C5', 'B', 'Pelo menos 1 aferição de pressão arterial nos últimos 6 meses', 25),
  ('C5', 'C', 'Pelo menos 1 registro de peso e altura nos últimos 12 meses', 25),
  ('C5', 'D', 'Pelo menos 2 visitas domiciliares de ACS/TACS (intervalo mín. 30 dias) nos últimos 12 meses', 25),

  ('C6', 'A', 'Pelo menos 1 consulta nos últimos 12 meses (médico/enfermeiro)', 25),
  ('C6', 'B', 'Pelo menos 1 registro simultâneo de peso e altura nos últimos 12 meses', 25),
  ('C6', 'C', 'Pelo menos 2 visitas domiciliares de ACS/TACS (intervalo mín. 30 dias) nos últimos 12 meses', 25),
  ('C6', 'D', 'Dose da vacina influenza nos últimos 12 meses', 25),

  ('C7', 'A', 'Rastreamento câncer de colo do útero (25-64 anos) nos últimos 36/60 meses', 20),
  ('C7', 'B', 'Dose de vacina HPV (9-14 anos, sexo feminino)', 30),
  ('C7', 'C', 'Atendimento de saúde sexual e reprodutiva (14-69 anos) nos últimos 12 meses', 30),
  ('C7', 'D', 'Rastreamento câncer de mama (50-69 anos) nos últimos 24 meses', 20)
) AS x(indicador_codigo, codigo, descricao, pontos)
JOIN indicadores_catalogo ic ON ic.codigo = x.indicador_codigo
ON CONFLICT (indicador_id, codigo_criterio) DO UPDATE
  SET descricao = EXCLUDED.descricao,
      pontos = EXCLUDED.pontos;
