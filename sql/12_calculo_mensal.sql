-- Recálculo mensal dos indicadores de qualidade — Nota Técnica nº 6/2025-DEAPS/SAPS/MS, item
-- 4.1: "o resultado do quadrimestre por indicador será obtido pela média dos meses
-- monitorados". Ver modo_calculo_atual()/periodo_quadrimestre()/upsert_resultado_indicador[_razao]
-- em sql/04_indicadores_motor_calculo.sql (e a versão razão em sql/09_indicadores_b1_b6.sql)
-- para como as 17 calculadoras (C1-C7/B1-B6/M1-M2) passaram a gravar aqui em vez de direto em
-- resultados_indicadores quando chamadas por recalcular_indicadores_qualidade — sem que nenhuma
-- delas tenha mudado a própria lógica de elegibilidade/contagem.

CREATE TABLE IF NOT EXISTS resultados_indicadores_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id uuid NOT NULL REFERENCES equipes(id),
  indicador_id uuid NOT NULL REFERENCES indicadores_catalogo(id),
  ano int NOT NULL,
  mes int NOT NULL CHECK (mes BETWEEN 1 AND 12),
  numerador numeric NOT NULL,
  denominador numeric NOT NULL,
  eh_razao boolean NOT NULL DEFAULT false,
  valor_calculado numeric NOT NULL,
  calculado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipe_id, indicador_id, ano, mes)
);

-- Os 4 meses de um quadrimestre, com os limites de data de cada um — usado por
-- recalcular_indicadores_qualidade() pra rodar cada calculadora 1x por mês.
CREATE OR REPLACE FUNCTION meses_do_quadrimestre(p_quadrimestre "Quadrimestre", p_ano int)
RETURNS TABLE(mes int, ano int, inicio date, fim date) LANGUAGE sql IMMUTABLE AS $$
  SELECT
    m,
    p_ano,
    make_date(p_ano, m, 1),
    (make_date(p_ano, m, 1) + interval '1 month' - interval '1 day')::date
  FROM unnest(
    CASE p_quadrimestre
      WHEN 'Q1' THEN ARRAY[1, 2, 3, 4]
      WHEN 'Q2' THEN ARRAY[5, 6, 7, 8]
      WHEN 'Q3' THEN ARRAY[9, 10, 11, 12]
    END
  ) AS m;
$$;

-- Um mês sem população elegível (denominador=0) não é gravado — fica de fora da média do
-- quadrimestre, exatamente a regra especial do item 4.1.1 da Nota Técnica 6 pra C2 (Cuidado no
-- desenvolvimento infantil) e C3 (Cuidado na gestação e puerpério): "o resultado quadrimestral
-- levará em consideração apenas os meses que possuam [coorte de fechamento]". Como toda
-- calculadora já só chama upsert_resultado_indicador[_razao] quando denominador>0, essa regra
-- vale de graça pros 15 indicadores, não só C2/C3.
CREATE OR REPLACE PROCEDURE upsert_resultado_indicador_mensal(
  p_equipe_id uuid, p_indicador_id uuid, p_ano int, p_mes int,
  p_numerador numeric, p_denominador numeric, p_eh_razao boolean
) LANGUAGE plpgsql AS $$
DECLARE
  v_valor numeric;
BEGIN
  IF p_denominador = 0 THEN RETURN; END IF;
  v_valor := CASE WHEN p_eh_razao THEN round(p_numerador / p_denominador, 4) ELSE round(100.0 * p_numerador / p_denominador, 2) END;

  INSERT INTO resultados_indicadores_mensal (id, equipe_id, indicador_id, ano, mes, numerador, denominador, eh_razao, valor_calculado, calculado_em)
  VALUES (gen_random_uuid(), p_equipe_id, p_indicador_id, p_ano, p_mes, p_numerador, p_denominador, p_eh_razao, v_valor, now())
  ON CONFLICT (equipe_id, indicador_id, ano, mes) DO UPDATE
    SET numerador = EXCLUDED.numerador,
        denominador = EXCLUDED.denominador,
        eh_razao = EXCLUDED.eh_razao,
        valor_calculado = EXCLUDED.valor_calculado,
        calculado_em = now();
END;
$$;

-- Agrega os meses de resultados_indicadores_mensal (média simples dos valores mensais — não
-- soma de numeradores/denominadores, conferido contra o exemplo oficial da Nota Técnica 6:
-- meses 42,62%/40,87%/41,9%/51,98% → média aritmética simples = 44,34%, batendo com o
-- "Resultado do Quadrimestre" do Quadro 1) em resultados_indicadores (quadrimestral, a mesma
-- tabela/formato de sempre — nenhuma tela precisa mudar pra ler o resultado). numerador/
-- denominador aqui viram a SOMA dos meses (só informativo pra "Base de Cálculo" na tela — não é
-- o que decide a classificação, que usa a média em valor_calculado).
CREATE OR REPLACE PROCEDURE agregar_resultados_mensais(p_quadrimestre "Quadrimestre", p_ano int)
LANGUAGE plpgsql AS $$
DECLARE
  v_meses int[];
  r record;
BEGIN
  SELECT array_agg(mes) INTO v_meses FROM meses_do_quadrimestre(p_quadrimestre, p_ano);

  FOR r IN
    SELECT
      equipe_id, indicador_id,
      round(avg(valor_calculado), CASE WHEN bool_and(eh_razao) THEN 4 ELSE 2 END) AS media,
      sum(numerador) AS soma_num,
      sum(denominador) AS soma_den
    FROM resultados_indicadores_mensal
    WHERE ano = p_ano AND mes = ANY(v_meses)
    GROUP BY equipe_id, indicador_id
  LOOP
    INSERT INTO resultados_indicadores
      (id, equipe_id, indicador_id, quadrimestre, ano, numerador, denominador, valor_calculado, classificacao, calculado_em)
    VALUES
      (gen_random_uuid(), r.equipe_id, r.indicador_id, p_quadrimestre, p_ano, r.soma_num, r.soma_den,
       r.media, classificar_indicador(r.indicador_id, r.media), now())
    ON CONFLICT (equipe_id, indicador_id, quadrimestre, ano) DO UPDATE
      SET numerador = EXCLUDED.numerador,
          denominador = EXCLUDED.denominador,
          valor_calculado = EXCLUDED.valor_calculado,
          classificacao = EXCLUDED.classificacao,
          calculado_em = now();
  END LOOP;
END;
$$;
