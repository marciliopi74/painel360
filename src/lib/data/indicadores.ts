import { prisma } from "@/lib/prisma";
import type { TipoEquipeAlvo } from "@prisma/client";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// requisito 20: tela segmentada por tipo de equipe alvo (ESF/eAP, eSB, eMulti).
export async function listarResultados(
  usuario: UsuarioSessao,
  tipoEquipeAlvo: TipoEquipeAlvo,
  quadrimestre: "Q1" | "Q2" | "Q3",
  ano: number,
) {
  const equipeId = await equipeIdPermitido(usuario);

  const indicadores = await prisma.indicadorCatalogo.findMany({
    where: { tipoEquipeAlvo, anoReferencia: ano },
    orderBy: { codigo: "asc" },
  });

  const tiposEquipe: Record<TipoEquipeAlvo, ("ESF" | "EAP" | "EMULTI" | "ESB")[]> = {
    ESF_EAP: ["ESF", "EAP"],
    ESB: ["ESB"],
    EMULTI: ["EMULTI"],
  };

  const equipes = await prisma.equipe.findMany({
    where: { tipo: { in: tiposEquipe[tipoEquipeAlvo] }, ativo: true, ...(equipeId ? { id: equipeId } : {}) },
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

// requisito 21: drill-down de C2-C7 até a pessoa, com os critérios atingidos.
export async function listarDrillDownIndicador(
  equipeId: string,
  indicadorId: string,
  quadrimestre: "Q1" | "Q2" | "Q3",
  ano: number,
) {
  const pontuacoes = await prisma.boaPraticaPontuacaoPessoa.findMany({
    where: { equipeId, indicadorId, quadrimestre, ano },
    include: { criterio: true },
    orderBy: [{ cidadaoCns: "asc" }, { criterio: { codigoCriterio: "asc" } }],
  });

  const porPessoa = new Map<string, typeof pontuacoes>();
  for (const p of pontuacoes) {
    const lista = porPessoa.get(p.cidadaoCns) ?? [];
    lista.push(p);
    porPessoa.set(p.cidadaoCns, lista);
  }
  return porPessoa;
}
