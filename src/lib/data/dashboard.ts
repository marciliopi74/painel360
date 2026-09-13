import { prisma } from "@/lib/prisma";
import type { Classificacao, Quadrimestre, TipoEquipe } from "@prisma/client";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { intervaloQuadrimestre } from "@/lib/data/periodo";

export type ResumoPorTipoEquipe = {
  tipo: TipoEquipe;
  equipesAtivas: number;
  cadastrosIndividuais: number;
  visitasAcs: number;
  atendimentos: number;
  percentualMetaAtingida: number | null;
  classificacaoPredominante: Classificacao | null;
};

export type ResumoGeral = {
  cadastrosIndividuaisTotal: number;
  cadastrosIndividuaisNovosNoMes: number;
  cadastrosDomiciliaresTotal: number;
  cadastrosDomiciliaresNovosNoMes: number;
  atendimentosPeriodo: number;
  mediaDiariaAtendimentos: number;
  inconsistencias: number;
  principaisTiposErro: string[];
  // média simples dos indicadores percentuais já apurados no período — não é o Indicador
  // Sintético Final oficial do SISAB (que usa pesos por indicador não documentados aqui).
  mediaIndicadoresPercentuais: number | null;
};

function rotuloTipoErro(tipoErro: string): string {
  return tipoErro.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());
}

export async function obterResumoGeral(
  usuario: UsuarioSessao,
  periodo: { quadrimestre: Quadrimestre; ano: number },
): Promise<ResumoGeral> {
  const equipeId = await equipeIdPermitido(usuario);
  const filtroEquipe = equipeId ? { equipeId } : {};
  const { inicio, fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
  const fimEfetivo = fim < agora ? fim : agora;
  const diasDecorridos = Math.max(
    1,
    Math.ceil((fimEfetivo.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );

  const [
    cadastrosIndividuaisTotal,
    cadastrosIndividuaisNovosNoMes,
    cadastrosDomiciliaresTotal,
    cadastrosDomiciliaresNovosNoMes,
    atendimentosPeriodo,
    errosIndividuais,
    errosDomiciliares,
    errosAtendimentos,
    resultados,
  ] = await Promise.all([
    prisma.cadastroIndividual.count({ where: { ...filtroEquipe } }),
    prisma.cadastroIndividual.count({ where: { ...filtroEquipe, dataCadastro: { gte: inicioMes } } }),
    prisma.cadastroDomiciliar.count({ where: { ...filtroEquipe } }),
    prisma.cadastroDomiciliar.count({ where: { ...filtroEquipe, dataCadastro: { gte: inicioMes } } }),
    prisma.atendimento.count({ where: { ...filtroEquipe, dataAtendimento: { gte: inicio, lte: fim } } }),
    prisma.cadastroIndividual.groupBy({
      by: ["tipoErro"],
      where: { ...filtroEquipe, temErro: true },
      _count: { _all: true },
    }),
    prisma.cadastroDomiciliar.groupBy({
      by: ["tipoErro"],
      where: { ...filtroEquipe, temErro: true },
      _count: { _all: true },
    }),
    prisma.atendimento.groupBy({
      by: ["tipoErro"],
      where: { ...filtroEquipe, temErro: true },
      _count: { _all: true },
    }),
    prisma.resultadoIndicador.findMany({
      where: { ...filtroEquipe, quadrimestre: periodo.quadrimestre, ano: periodo.ano },
      select: { valorCalculado: true, indicador: { select: { unidadeMedida: true } } },
    }),
  ]);

  const contagemPorTipoErro = new Map<string, number>();
  for (const grupo of [...errosIndividuais, ...errosDomiciliares, ...errosAtendimentos]) {
    if (!grupo.tipoErro) continue;
    contagemPorTipoErro.set(grupo.tipoErro, (contagemPorTipoErro.get(grupo.tipoErro) ?? 0) + grupo._count._all);
  }
  const inconsistencias = [...contagemPorTipoErro.values()].reduce((soma, n) => soma + n, 0);
  const principaisTiposErro = [...contagemPorTipoErro.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([tipo]) => rotuloTipoErro(tipo));

  const percentuais = resultados.filter((r) => r.indicador.unidadeMedida === "percentual");
  const mediaIndicadoresPercentuais =
    percentuais.length > 0
      ? Math.round((percentuais.reduce((soma, r) => soma + Number(r.valorCalculado), 0) / percentuais.length) * 10) /
        10
      : null;

  return {
    cadastrosIndividuaisTotal,
    cadastrosIndividuaisNovosNoMes,
    cadastrosDomiciliaresTotal,
    cadastrosDomiciliaresNovosNoMes,
    atendimentosPeriodo,
    mediaDiariaAtendimentos: Math.round((atendimentosPeriodo / diasDecorridos) * 10) / 10,
    inconsistencias,
    principaisTiposErro,
    mediaIndicadoresPercentuais,
  };
}

// requisitos 8-9: painel inicial segmentado por tipo de equipe (ESF, EAP, EMULTI, ESB).
export async function obterResumoPorTipoEquipe(
  usuario: UsuarioSessao,
  periodo: { quadrimestre: Quadrimestre; ano: number },
  tipos: TipoEquipe[] = ["ESF", "EAP", "EMULTI", "ESB"],
): Promise<ResumoPorTipoEquipe[]> {
  const equipeId = await equipeIdPermitido(usuario);
  const filtroEquipe = equipeId ? { equipeId } : {};

  return Promise.all(
    tipos.map(async (tipo) => {
      const whereEquipe = { tipo, ...(equipeId ? { id: equipeId } : {}) };

      const [equipesAtivas, cadastrosIndividuais, visitasAcs, atendimentos, resultados] = await Promise.all([
        prisma.equipe.count({ where: { ...whereEquipe, ativo: true } }),
        prisma.cadastroIndividual.count({ where: { equipe: whereEquipe, ...filtroEquipe } }),
        prisma.cadastroDomiciliar.count({
          where: { equipe: whereEquipe, ...filtroEquipe, profissional: { ehAcs: true } },
        }),
        prisma.atendimento.count({ where: { equipe: whereEquipe, ...filtroEquipe } }),
        prisma.resultadoIndicador.findMany({
          where: { equipe: whereEquipe, quadrimestre: periodo.quadrimestre, ano: periodo.ano },
          select: { valorCalculado: true, classificacao: true },
        }),
      ]);

      const percentualMetaAtingida =
        resultados.length > 0
          ? Math.round(
              (resultados.reduce((soma, r) => soma + Number(r.valorCalculado), 0) / resultados.length) * 100,
            ) / 100
          : null;

      let classificacaoPredominante: Classificacao | null = null;
      if (resultados.length > 0) {
        const contagem = new Map<Classificacao, number>();
        for (const r of resultados) contagem.set(r.classificacao, (contagem.get(r.classificacao) ?? 0) + 1);
        classificacaoPredominante = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }

      return {
        tipo,
        equipesAtivas,
        cadastrosIndividuais,
        visitasAcs,
        atendimentos,
        percentualMetaAtingida,
        classificacaoPredominante,
      };
    }),
  );
}
