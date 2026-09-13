import type { Classificacao, Quadrimestre, TipoEquipeAlvo } from "@prisma/client";
import type { UsuarioSessao } from "@/lib/rbac";
import { obterIndicadoresMunicipais, type IndicadorMunicipal } from "@/lib/data/indicadores";
import { quadrimestreAnterior } from "@/lib/data/periodo";

const ALVOS: TipoEquipeAlvo[] = ["ESF_EAP", "ESB", "EMULTI"];

export type IndicadorAvaliacao = IndicadorMunicipal & {
  alvo: TipoEquipeAlvo;
  resultadoAnterior: IndicadorMunicipal["resultado"];
};

export type NotaFinalEixo = {
  alvo: TipoEquipeAlvo;
  nota: number;
  pesoTotal: number;
  pesoApurado: number;
  indicadoresApurados: number;
  indicadoresTotal: number;
  classificacao: Classificacao;
};

export type AvaliacaoQuadrimestral = {
  indicadores: IndicadorAvaliacao[];
  media: number | null;
  mediaAnterior: number | null;
  metasBatidas: number;
  alertas: number;
  apurados: number;
  anterior: { quadrimestre: Quadrimestre; ano: number };
  notasFinais: NotaFinalEixo[];
};

function mediaPercentuais(indicadores: IndicadorMunicipal[]): number | null {
  const valores = indicadores.filter((i) => i.unidadeMedida === "percentual" && i.resultado).map((i) => i.resultado!.valorCalculado);
  return valores.length > 0 ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null;
}

// Nota Técnica nº 6/2025-DEAPS/SAPS/MS, Quadros 2-4 — pesos de cada indicador no cálculo da
// "Nota Final do Componente III" (verificados em 2026-09-13 direto no PDF oficial via extração
// sem heurística de layout, já que a extração com layout embaralhava a ordem das células dessas
// tabelas — a mesma armadilha do Anexo XCIX da Nota Técnica 30). Conferido batendo a soma de
// pesos e o total do exemplo oficial de cada quadro (8,5 para ESF/eAP, 7,75 para eSB, 9,0 para
// eMulti).
const PESOS_INDICADOR: Record<string, number> = {
  C1: 1, C2: 2, C3: 2, C4: 1, C5: 1, C6: 1, C7: 2,
  B1: 2, B2: 2, B3: 2, B4: 2, B5: 1, B6: 1,
  M1: 6, M2: 4,
};

// item 4.3.2 da Nota Técnica 6 — pontuação de cada conceito no cálculo da Nota Final.
const PONTOS_CONCEITO: Record<Classificacao, number> = { regular: 0.25, suficiente: 0.5, bom: 0.75, otimo: 1.0 };

// Quadro 6 da Nota Técnica 6 — classificação da Nota Final do Componente III para fins de
// incentivo financeiro (diferente das faixas usadas para classificar cada indicador individual).
function classificarNotaFinalComponenteIII(nota: number): Classificacao {
  if (nota > 7.5) return "otimo";
  if (nota >= 5) return "bom";
  if (nota >= 2.6) return "suficiente";
  return "regular";
}

// item 4.3.1 da Nota Técnica 6 — Nota Final do Componente III = soma de peso×conceito por
// indicador. Calculada aqui por eixo sobre o resultado MUNICIPAL agregado (mesmo nível que o
// resto desta tela já opera, via obterIndicadoresMunicipais) — não é a nota por equipe
// individual do exemplo oficial (que exigiria uma tela própria por equipe, como
// /vinculo-acompanhamento tem para o Componente II). Indicadores sem apuração no período ficam
// de fora da soma (não contam 0 nem são inventados) — pesoApurado/pesoTotal deixa claro quanto
// da nota ainda não está fechado.
function calcularNotaFinal(alvo: TipoEquipeAlvo, indicadores: IndicadorMunicipal[]): NotaFinalEixo {
  const pesoTotal = indicadores.reduce((s, i) => s + (PESOS_INDICADOR[i.codigo] ?? 0), 0);
  // resultado.classificacao pode ser null mesmo com resultado não-nulo (bandas de classificação
  // incompletas — ver classificarIndicador em src/lib/data/indicadores.ts) — sem conceito, não
  // dá pra somar no peso×conceito, então fica de fora igual um indicador não apurado.
  const apurados = indicadores.flatMap((i) =>
    i.resultado && i.resultado.classificacao ? [{ ...i, resultado: { ...i.resultado, classificacao: i.resultado.classificacao } }] : [],
  );
  const pesoApurado = apurados.reduce((s, i) => s + (PESOS_INDICADOR[i.codigo] ?? 0), 0);
  const nota = Math.round(apurados.reduce((s, i) => s + (PESOS_INDICADOR[i.codigo] ?? 0) * PONTOS_CONCEITO[i.resultado.classificacao], 0) * 100) / 100;

  return {
    alvo,
    nota,
    pesoTotal,
    pesoApurado,
    indicadoresApurados: apurados.length,
    indicadoresTotal: indicadores.length,
    classificacao: classificarNotaFinalComponenteIII(nota),
  };
}

// requisito 23: visão de fechamento com os 15 indicadores oficiais (C1-C7+B1-B6+M1-M2) juntos
// para o quadrimestre selecionado, com comparação ao quadrimestre anterior — diferente de
// /indicadores-qualidade, que mostra um eixo por vez para acompanhamento contínuo.
export async function obterAvaliacaoQuadrimestral(
  usuario: UsuarioSessao,
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<AvaliacaoQuadrimestral> {
  const anterior = quadrimestreAnterior(quadrimestre, ano);

  const [atualPorAlvo, anteriorPorAlvo] = await Promise.all([
    Promise.all(ALVOS.map((alvo) => obterIndicadoresMunicipais(usuario, alvo, quadrimestre, ano))),
    Promise.all(ALVOS.map((alvo) => obterIndicadoresMunicipais(usuario, alvo, anterior.quadrimestre, anterior.ano))),
  ]);

  const indicadores: IndicadorAvaliacao[] = [];
  ALVOS.forEach((alvo, i) => {
    const anteriorMap = new Map(anteriorPorAlvo[i].indicadores.map((ind) => [ind.id, ind.resultado]));
    for (const ind of atualPorAlvo[i].indicadores) {
      indicadores.push({ ...ind, alvo, resultadoAnterior: anteriorMap.get(ind.id) ?? null });
    }
  });

  const apurados = indicadores.filter((i) => i.resultado);
  const metasBatidas = apurados.filter((i) => i.resultado!.classificacao === "otimo" || i.resultado!.classificacao === "bom").length;
  const alertas = apurados.filter((i) => i.resultado!.classificacao === "suficiente" || i.resultado!.classificacao === "regular").length;

  const notasFinais = ALVOS.map((alvo, i) => calcularNotaFinal(alvo, atualPorAlvo[i].indicadores));

  return {
    indicadores,
    media: mediaPercentuais(indicadores),
    mediaAnterior: mediaPercentuais(anteriorPorAlvo.flatMap((r) => r.indicadores)),
    metasBatidas,
    alertas,
    apurados: apurados.length,
    anterior,
    notasFinais,
  };
}
