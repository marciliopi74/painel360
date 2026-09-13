import { prisma } from "@/lib/prisma";
import type { Classificacao, Polaridade, TipoEquipe, TipoEquipeAlvo, UnidadeMedida } from "@prisma/client";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

export const TIPOS_POR_ALVO: Record<TipoEquipeAlvo, TipoEquipe[]> = {
  ESF_EAP: ["ESF", "EAP"],
  ESB: ["ESB"],
  EMULTI: ["EMULTI"],
};

// `anoReferencia` no catálogo é o ano da Nota Metodológica vigente (hoje só existe a versão
// 2024 de cada indicador), não o ano corrente do calendário — filtrar por igualdade
// (`anoReferencia: anoAtual`) fazia a lista voltar vazia assim que o ano civil passou de 2024
// (bug real encontrado em 2026-09-13 construindo a Visão da Equipe). Em vez disso, pega a
// versão mais recente cujo anoReferencia seja <= ao ano da competência sendo consultada.
export async function obterIndicadoresVigentes(tipoEquipeAlvo: TipoEquipeAlvo, ano: number) {
  const candidatos = await prisma.indicadorCatalogo.findMany({
    where: { tipoEquipeAlvo, anoReferencia: { lte: ano } },
    orderBy: [{ anoReferencia: "desc" }],
  });

  const porCodigo = new Map<string, (typeof candidatos)[number]>();
  for (const c of candidatos) if (!porCodigo.has(c.codigo)) porCodigo.set(c.codigo, c);
  return [...porCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export type BandasIndicador = {
  polaridade: Polaridade;
  parametroOtimoMin: number | null;
  parametroOtimoMax: number | null;
  parametroBomMin: number | null;
  parametroBomMax: number | null;
  parametroSuficienteMin: number | null;
  parametroSuficienteMax: number | null;
};

// Porta fiel de classificar_indicador() em sql/04_indicadores_motor_calculo.sql — usada aqui
// para classificar valores agregados (município) que não correspondem a nenhuma linha já
// gravada em resultados_indicadores (essa tabela só guarda o resultado por equipe).
export function classificarIndicador(indicador: BandasIndicador, valor: number): Classificacao | null {
  const { polaridade, parametroOtimoMin, parametroOtimoMax, parametroBomMin, parametroBomMax, parametroSuficienteMin, parametroSuficienteMax } = indicador;

  if (polaridade === "maior_melhor") {
    if (parametroOtimoMin === null || parametroBomMin === null || parametroSuficienteMin === null) return null;
    if (valor >= parametroOtimoMin) return "otimo";
    if (valor >= parametroBomMin) return "bom";
    if (valor >= parametroSuficienteMin) return "suficiente";
    return "regular";
  }
  if (polaridade === "menor_melhor") {
    if (parametroOtimoMax === null || parametroBomMax === null || parametroSuficienteMax === null) return null;
    if (valor <= parametroOtimoMax) return "otimo";
    if (valor <= parametroBomMax) return "bom";
    if (valor <= parametroSuficienteMax) return "suficiente";
    return "regular";
  }
  // neutra: usado por C1/B3/B5 (regular tanto abaixo do mínimo quanto acima do máximo). Limite
  // inferior EXCLUSIVO / superior INCLUSIVO — ver mesma correção e motivo em
  // classificar_indicador() no sql/04_indicadores_motor_calculo.sql (2026-09-13).
  if (parametroOtimoMin === null || parametroOtimoMax === null || parametroBomMin === null || parametroBomMax === null || parametroSuficienteMin === null || parametroSuficienteMax === null) {
    return null;
  }
  if (valor > parametroOtimoMin && valor <= parametroOtimoMax) return "otimo";
  if (valor > parametroBomMin && valor <= parametroBomMax) return "bom";
  if (valor > parametroSuficienteMin && valor <= parametroSuficienteMax) return "suficiente";
  return "regular";
}

export type FaixaParametro = {
  classificacao: Classificacao;
  rotulo: string;
  intervalo: string;
};

function formatarNumero(n: number): string {
  // evita "50.00" — só mostra casas decimais quando o valor realmente não é inteiro (bandas
  // como as de B1/M1 usam razões com 2 casas, ex. 1.25).
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100).replace(".", ",");
}

// Bloco "Parâmetro" das Notas Metodológicas oficiais: 4 faixas (Ótimo/Bom/Suficiente/Regular)
// com o intervalo de valores de cada uma, no MESMO formato de exibição usado pelas notas
// (limite inferior exclusivo, superior inclusivo — ex. "> 50 e ≤ 70"; Regular junta as duas
// pontas fora do intervalo coberto). Deriva sempre dos parametro*Min/Max já cadastrados — não é
// um texto solto separado, então nunca pode divergir dos números reais do indicador. Esta
// convenção de fronteira bate exatamente com a usada por classificarIndicador() acima /
// classificar_indicador() no SQL (corrigido em 2026-09-13 para os dois usarem o mesmo critério).
export function formatarFaixasParametro(indicador: BandasIndicador, unidade: UnidadeMedida): FaixaParametro[] | null {
  const sufixo = unidade === "percentual" ? "%" : "";
  const fmt = (n: number) => `${formatarNumero(n)}${sufixo}`;
  const { polaridade, parametroOtimoMin, parametroOtimoMax, parametroBomMin, parametroBomMax, parametroSuficienteMin, parametroSuficienteMax } = indicador;

  if (polaridade === "maior_melhor") {
    if (parametroOtimoMin === null || parametroBomMin === null || parametroSuficienteMin === null) return null;
    return [
      { classificacao: "otimo", rotulo: "Ótimo", intervalo: `≥ ${fmt(parametroOtimoMin)}` },
      { classificacao: "bom", rotulo: "Bom", intervalo: `≥ ${fmt(parametroBomMin)} e < ${fmt(parametroOtimoMin)}` },
      { classificacao: "suficiente", rotulo: "Suficiente", intervalo: `≥ ${fmt(parametroSuficienteMin)} e < ${fmt(parametroBomMin)}` },
      { classificacao: "regular", rotulo: "Regular", intervalo: `< ${fmt(parametroSuficienteMin)}` },
    ];
  }
  if (polaridade === "menor_melhor") {
    if (parametroOtimoMax === null || parametroBomMax === null || parametroSuficienteMax === null) return null;
    return [
      { classificacao: "otimo", rotulo: "Ótimo", intervalo: `≤ ${fmt(parametroOtimoMax)}` },
      { classificacao: "bom", rotulo: "Bom", intervalo: `> ${fmt(parametroOtimoMax)} e ≤ ${fmt(parametroBomMax)}` },
      { classificacao: "suficiente", rotulo: "Suficiente", intervalo: `> ${fmt(parametroBomMax)} e ≤ ${fmt(parametroSuficienteMax)}` },
      { classificacao: "regular", rotulo: "Regular", intervalo: `> ${fmt(parametroSuficienteMax)}` },
    ];
  }
  // neutra: cada faixa "> min e ≤ max"; Regular junta as duas pontas fora do intervalo Ótimo-Suficiente.
  if (
    parametroOtimoMin === null || parametroOtimoMax === null ||
    parametroBomMin === null || parametroBomMax === null ||
    parametroSuficienteMin === null || parametroSuficienteMax === null
  ) {
    return null;
  }
  return [
    { classificacao: "otimo", rotulo: "Ótimo", intervalo: `> ${fmt(parametroOtimoMin)} e ≤ ${fmt(parametroOtimoMax)}` },
    { classificacao: "bom", rotulo: "Bom", intervalo: `> ${fmt(parametroBomMin)} e ≤ ${fmt(parametroBomMax)}` },
    { classificacao: "suficiente", rotulo: "Suficiente", intervalo: `> ${fmt(parametroSuficienteMin)} e ≤ ${fmt(parametroSuficienteMax)}` },
    { classificacao: "regular", rotulo: "Regular", intervalo: `≤ ${fmt(parametroSuficienteMin)} ou > ${fmt(parametroOtimoMax)}` },
  ];
}

// requisito: média municipal (todos os eixos) para o mini-card de Relatórios — mesmo cálculo
// (ponderado por denominador, não uma média simples entre equipes) usado em
// obterIndicadoresMunicipais, só que somando os 3 eixos em vez de olhar um por vez.
export async function obterMediaIndicadoresGeral(
  usuario: UsuarioSessao,
  quadrimestre: "Q1" | "Q2" | "Q3",
  ano: number,
): Promise<{ media: number | null; apurados: number } > {
  const equipeIdRestrito = await equipeIdPermitido(usuario);

  const todosIndicadores = (
    await Promise.all((Object.keys(TIPOS_POR_ALVO) as TipoEquipeAlvo[]).map((alvo) => obterIndicadoresVigentes(alvo, ano)))
  ).flat();
  const percentuais = todosIndicadores.filter((i) => i.unidadeMedida === "percentual");

  const equipes = await prisma.equipe.findMany({
    where: { ativo: true, ...(equipeIdRestrito ? { id: equipeIdRestrito } : {}) },
    select: { id: true },
  });

  const resultados = await prisma.resultadoIndicador.findMany({
    where: { quadrimestre, ano, equipeId: { in: equipes.map((e) => e.id) }, indicadorId: { in: percentuais.map((i) => i.id) } },
  });

  const porIndicador = new Map<string, typeof resultados>();
  for (const r of resultados) {
    const lista = porIndicador.get(r.indicadorId) ?? [];
    lista.push(r);
    porIndicador.set(r.indicadorId, lista);
  }

  const valores: number[] = [];
  for (const [, lista] of porIndicador) {
    const numerador = lista.reduce((s, r) => s + Number(r.numerador), 0);
    const denominador = lista.reduce((s, r) => s + Number(r.denominador), 0);
    if (denominador > 0) valores.push((numerador / denominador) * 100);
  }

  return {
    media: valores.length > 0 ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null,
    apurados: valores.length,
  };
}

// requisito 20: tela segmentada por tipo de equipe alvo (ESF/eAP, eSB, eMulti).
export async function listarResultados(
  usuario: UsuarioSessao,
  tipoEquipeAlvo: TipoEquipeAlvo,
  quadrimestre: "Q1" | "Q2" | "Q3",
  ano: number,
) {
  const equipeId = await equipeIdPermitido(usuario);

  const indicadores = await obterIndicadoresVigentes(tipoEquipeAlvo, ano);

  const equipes = await prisma.equipe.findMany({
    where: { tipo: { in: TIPOS_POR_ALVO[tipoEquipeAlvo] }, ativo: true, ...(equipeId ? { id: equipeId } : {}) },
    orderBy: { nome: "asc" },
  });

  const resultados = await prisma.resultadoIndicador.findMany({
    where: {
      quadrimestre,
      ano,
      equipeId: { in: equipes.map((e) => e.id) },
      indicadorId: { in: indicadores.map((i) => i.id) },
    },
  });

  const porChave = new Map(resultados.map((r) => [`${r.equipeId}:${r.indicadorId}`, r]));

  return { indicadores, equipes, porChave };
}

export type ResultadoMunicipal = {
  numerador: number;
  denominador: number;
  valorCalculado: number;
  classificacao: Classificacao | null;
  elegiveis: number | null;
  equipesApuradas: number;
};

export type IndicadorMunicipal = {
  id: string;
  codigo: string;
  nome: string;
  categoria: "boa_pratica_pontuada" | "indicador_proporcional" | "indicador_media";
  unidadeMedida: UnidadeMedida;
  parametroBomMin: number | null;
  bandas: BandasIndicador;
  formulaNumerador: string | null;
  formulaDenominador: string | null;
  resultado: ResultadoMunicipal | null;
};

// requisito 20: agregado municipal por indicador — pondera cada equipe pelo seu próprio
// denominador (matematicamente equivalente a somar numerador/denominador de todas as equipes),
// em vez de uma média simples entre equipes de tamanhos muito diferentes.
export async function obterIndicadoresMunicipais(
  usuario: UsuarioSessao,
  tipoEquipeAlvo: TipoEquipeAlvo,
  quadrimestre: "Q1" | "Q2" | "Q3",
  ano: number,
): Promise<{ indicadores: IndicadorMunicipal[]; equipeIds: string[] }> {
  const equipeIdRestrito = await equipeIdPermitido(usuario);

  const [indicadoresCatalogo, equipes] = await Promise.all([
    obterIndicadoresVigentes(tipoEquipeAlvo, ano),
    prisma.equipe.findMany({
      where: { tipo: { in: TIPOS_POR_ALVO[tipoEquipeAlvo] }, ativo: true, ...(equipeIdRestrito ? { id: equipeIdRestrito } : {}) },
      select: { id: true },
    }),
  ]);
  const equipeIds = equipes.map((e) => e.id);

  const resultados = await prisma.resultadoIndicador.findMany({
    where: { quadrimestre, ano, equipeId: { in: equipeIds }, indicadorId: { in: indicadoresCatalogo.map((i) => i.id) } },
  });

  const porIndicador = new Map<string, typeof resultados>();
  for (const r of resultados) {
    const lista = porIndicador.get(r.indicadorId) ?? [];
    lista.push(r);
    porIndicador.set(r.indicadorId, lista);
  }

  const indicadores = indicadoresCatalogo.map((ind) => {
    const bandas: BandasIndicador = {
      polaridade: ind.polaridade,
      parametroOtimoMin: ind.parametroOtimoMin ? Number(ind.parametroOtimoMin) : null,
      parametroOtimoMax: ind.parametroOtimoMax ? Number(ind.parametroOtimoMax) : null,
      parametroBomMin: ind.parametroBomMin ? Number(ind.parametroBomMin) : null,
      parametroBomMax: ind.parametroBomMax ? Number(ind.parametroBomMax) : null,
      parametroSuficienteMin: ind.parametroSuficienteMin ? Number(ind.parametroSuficienteMin) : null,
      parametroSuficienteMax: ind.parametroSuficienteMax ? Number(ind.parametroSuficienteMax) : null,
    };

    const resultadosIndicador = porIndicador.get(ind.id) ?? [];
    if (resultadosIndicador.length === 0) {
      return {
        id: ind.id,
        codigo: ind.codigo,
        nome: ind.nome,
        categoria: ind.categoria,
        unidadeMedida: ind.unidadeMedida,
        parametroBomMin: bandas.parametroBomMin,
        bandas,
        formulaNumerador: ind.formulaNumerador,
        formulaDenominador: ind.formulaDenominador,
        resultado: null,
      };
    }

    const numerador = resultadosIndicador.reduce((s, r) => s + Number(r.numerador), 0);
    const denominador = resultadosIndicador.reduce((s, r) => s + Number(r.denominador), 0);
    const valorCalculado = denominador === 0 ? 0 : Math.round((numerador / denominador) * (ind.unidadeMedida === "percentual" ? 100 : 1) * 100) / 100;

    const classificacao = classificarIndicador(bandas, valorCalculado);

    return {
      id: ind.id,
      codigo: ind.codigo,
      nome: ind.nome,
      categoria: ind.categoria,
      unidadeMedida: ind.unidadeMedida,
      parametroBomMin: bandas.parametroBomMin,
      bandas,
      formulaNumerador: ind.formulaNumerador,
      formulaDenominador: ind.formulaDenominador,
      resultado: {
        numerador,
        denominador,
        valorCalculado,
        classificacao,
        elegiveis: ind.categoria === "boa_pratica_pontuada" ? Math.round(denominador / 100) : null,
        equipesApuradas: resultadosIndicador.length,
      },
    };
  });

  return { indicadores, equipeIds };
}
