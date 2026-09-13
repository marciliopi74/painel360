import type { Quadrimestre, TipoEquipe, TipoEquipeAlvo, UnidadeMedida } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { intervaloQuadrimestre } from "@/lib/data/periodo";
import { obterIndicadoresVigentes, type BandasIndicador } from "@/lib/data/indicadores";

const ALVO_POR_TIPO: Record<TipoEquipe, TipoEquipeAlvo> = {
  ESF: "ESF_EAP",
  EAP: "ESF_EAP",
  EMULTI: "EMULTI",
  ESB: "ESB",
};

// requisito 3: retorna null se a equipe não existe ou se o usuário (profissional) está
// restrito a outra equipe — a página trata null como 404.
export async function obterEquipe(usuario: UsuarioSessao, equipeId: string) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  if (equipeIdRestrito && equipeIdRestrito !== equipeId) return null;

  return prisma.equipe.findUnique({
    where: { id: equipeId },
    include: {
      equipeReferencia: { select: { id: true, nome: true, tipo: true } },
      _count: { select: { profissionais: { where: { ativo: true } } } },
    },
  });
}

export async function listarEquipesParaSeletor(usuario: UsuarioSessao) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  return prisma.equipe.findMany({
    where: { ativo: true, ...(equipeIdRestrito ? { id: equipeIdRestrito } : {}) },
    select: { id: true, nome: true, tipo: true },
    orderBy: [{ tipo: "asc" }, { nome: "asc" }],
  });
}

export type IndicadorEquipe = {
  id: string;
  codigo: string;
  nome: string;
  categoria: "boa_pratica_pontuada" | "indicador_proporcional" | "indicador_media";
  unidadeMedida: UnidadeMedida;
  bandas: BandasIndicador;
  formulaNumerador: string | null;
  formulaDenominador: string | null;
  resultado: {
    numerador: number;
    denominador: number;
    valorCalculado: number;
    classificacao: "otimo" | "bom" | "suficiente" | "regular";
  } | null;
  parametroBomMin: number | null;
};

// requisito 20/21: indicadores oficiais já apurados para a equipe no período — reaproveita
// resultadosIndicadores calculado pelo motor em sql/04-10, nada é recalculado aqui.
export async function listarIndicadoresEquipe(
  tipo: TipoEquipe,
  equipeId: string,
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<IndicadorEquipe[]> {
  const indicadores = await obterIndicadoresVigentes(ALVO_POR_TIPO[tipo], ano);

  const resultados = await prisma.resultadoIndicador.findMany({
    where: { equipeId, quadrimestre, ano, indicadorId: { in: indicadores.map((i) => i.id) } },
  });
  const porIndicador = new Map(resultados.map((r) => [r.indicadorId, r]));

  return indicadores.map((ind) => {
    const r = porIndicador.get(ind.id);
    const bandas: BandasIndicador = {
      polaridade: ind.polaridade,
      parametroOtimoMin: ind.parametroOtimoMin ? Number(ind.parametroOtimoMin) : null,
      parametroOtimoMax: ind.parametroOtimoMax ? Number(ind.parametroOtimoMax) : null,
      parametroBomMin: ind.parametroBomMin ? Number(ind.parametroBomMin) : null,
      parametroBomMax: ind.parametroBomMax ? Number(ind.parametroBomMax) : null,
      parametroSuficienteMin: ind.parametroSuficienteMin ? Number(ind.parametroSuficienteMin) : null,
      parametroSuficienteMax: ind.parametroSuficienteMax ? Number(ind.parametroSuficienteMax) : null,
    };
    return {
      id: ind.id,
      codigo: ind.codigo,
      nome: ind.nome,
      categoria: ind.categoria,
      unidadeMedida: ind.unidadeMedida,
      bandas,
      formulaNumerador: ind.formulaNumerador,
      formulaDenominador: ind.formulaDenominador,
      parametroBomMin: bandas.parametroBomMin,
      resultado: r
        ? {
            numerador: Number(r.numerador),
            denominador: Number(r.denominador),
            valorCalculado: Number(r.valorCalculado),
            classificacao: r.classificacao,
          }
        : null,
    };
  });
}

export type ProducaoEquipe = {
  atendimentos: number;
  cadastrosIndividuais: number;
  cadastrosDomiciliares: number;
  comErro: number;
};

export async function obterProducaoEquipe(equipeId: string, quadrimestre: Quadrimestre, ano: number): Promise<ProducaoEquipe> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const [atendimentos, cadastrosIndividuais, cadastrosDomiciliares, erroAtendimentos, erroIndividuais, erroDomiciliares] = await Promise.all([
    prisma.atendimento.count({ where: { equipeId, dataAtendimento: { gte: inicio, lte: fim } } }),
    prisma.cadastroIndividual.count({ where: { equipeId, dataCadastro: { gte: inicio, lte: fim } } }),
    prisma.cadastroDomiciliar.count({ where: { equipeId, dataCadastro: { gte: inicio, lte: fim } } }),
    prisma.atendimento.count({ where: { equipeId, dataAtendimento: { gte: inicio, lte: fim }, temErro: true } }),
    prisma.cadastroIndividual.count({ where: { equipeId, dataCadastro: { gte: inicio, lte: fim }, temErro: true } }),
    prisma.cadastroDomiciliar.count({ where: { equipeId, dataCadastro: { gte: inicio, lte: fim }, temErro: true } }),
  ]);

  return {
    atendimentos,
    cadastrosIndividuais,
    cadastrosDomiciliares,
    comErro: erroAtendimentos + erroIndividuais + erroDomiciliares,
  };
}

export type ProfissionalDetalhado = {
  id: string;
  nome: string;
  cbo: string;
  ehAcs: boolean;
  ativo: boolean;
  cadastrosIndividuaisRegistrados: number;
  visitasDomiciliaresRegistradas: number;
};

// requisito 13: produção por profissional só é atribuível com confiança para cadastros
// individuais/domiciliares (quem registrou a ficha no e-SUS) — atendimentos clínicos não têm
// profissional_id confiável nos dados sincronizados (ver docs/esus-fdw.md), por isso não entram
// aqui (a produção clínica da equipe como um todo já aparece em obterProducaoEquipe).
export async function listarProfissionaisDetalhados(equipeId: string): Promise<ProfissionalDetalhado[]> {
  const profissionais = await prisma.profissional.findMany({
    where: { equipeId },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
  });

  return Promise.all(
    profissionais.map(async (p) => {
      const [cadastrosIndividuaisRegistrados, visitasDomiciliaresRegistradas] = await Promise.all([
        prisma.cadastroIndividual.count({ where: { profissionalId: p.id } }),
        prisma.cadastroDomiciliar.count({ where: { profissionalId: p.id } }),
      ]);
      return {
        id: p.id,
        nome: p.nome,
        cbo: p.cbo,
        ehAcs: p.ehAcs,
        ativo: p.ativo,
        cadastrosIndividuaisRegistrados,
        visitasDomiciliaresRegistradas,
      };
    }),
  );
}
