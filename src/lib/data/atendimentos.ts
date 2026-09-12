import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// requisito 14: meta mensal de atendimentos por profissional. Não existe uma tela de metas no
// schema atual — usamos um valor fixo configurável por variável de ambiente até que
// "configurações do sistema local" (requisito 4) ganhe uma tela própria para isso.
const META_MENSAL_POR_PROFISSIONAL = Number(process.env.META_ATENDIMENTOS_MENSAL ?? 80);

export type LinhaMetaEquipe = {
  equipeId: string;
  nomeEquipe: string;
  atendimentosNoMes: number;
  profissionaisAtivos: number;
  metaEquipe: number;
  percentualMetaAtingida: number | null;
};

// requisito 13: número de atendimentos por profissional. Só é possível para atendimentos que
// têm profissional_id preenchido — os sincronizados via e-SUS não resolvem o profissional
// individual a partir do fato do data warehouse (ver docs/esus-fdw.md), então aparecem
// agregados por equipe na segunda tabela desta tela.
export async function listarAtendimentosPorProfissional(usuario: UsuarioSessao) {
  const equipeId = await equipeIdPermitido(usuario);

  const grupos = await prisma.atendimento.groupBy({
    by: ["profissionalId"],
    where: { profissionalId: { not: null }, ...(equipeId ? { equipeId } : {}) },
    _count: { _all: true },
  });

  const profissionais = await prisma.profissional.findMany({
    where: { id: { in: grupos.map((g) => g.profissionalId!).filter(Boolean) } },
    select: { id: true, nome: true, equipe: { select: { nome: true } } },
  });
  const porId = new Map(profissionais.map((p) => [p.id, p]));

  return grupos
    .map((g) => ({
      profissionalId: g.profissionalId!,
      nome: porId.get(g.profissionalId!)?.nome ?? "—",
      equipe: porId.get(g.profissionalId!)?.equipe.nome ?? "—",
      total: g._count._all,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function listarMetaPorEquipe(usuario: UsuarioSessao): Promise<LinhaMetaEquipe[]> {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const equipes = await prisma.equipe.findMany({
    where: { ativo: true, ...(equipeIdRestrito ? { id: equipeIdRestrito } : {}) },
    select: {
      id: true,
      nome: true,
      _count: { select: { profissionais: { where: { ativo: true, ehAcs: false } } } },
    },
  });

  return Promise.all(
    equipes.map(async (eq) => {
      const atendimentosNoMes = await prisma.atendimento.count({
        where: { equipeId: eq.id, dataAtendimento: { gte: inicioMes } },
      });
      const metaEquipe = META_MENSAL_POR_PROFISSIONAL * Math.max(eq._count.profissionais, 1);
      return {
        equipeId: eq.id,
        nomeEquipe: eq.nome,
        atendimentosNoMes,
        profissionaisAtivos: eq._count.profissionais,
        metaEquipe,
        percentualMetaAtingida: Math.round((atendimentosNoMes / metaEquipe) * 10000) / 100,
      };
    }),
  );
}
