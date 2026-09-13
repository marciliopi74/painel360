import { Prisma, type TipoEquipe } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { intervaloQuadrimestre } from "@/lib/data/periodo";
import { ROTULO_ERRO } from "@/lib/data/erros";
import type { StatusCadastro } from "@/lib/data/cadastros";

// requisito 14: meta mensal de atendimentos por profissional. Não existe uma tela de metas no
// schema atual — usamos um valor fixo configurável por variável de ambiente até que
// "configurações do sistema local" (requisito 4) ganhe uma tela própria para isso.
const META_MENSAL_POR_PROFISSIONAL = Number(process.env.META_ATENDIMENTOS_MENSAL ?? 80);

export type FiltrosAtendimento = {
  tipoEquipe?: TipoEquipe;
  equipeId?: string;
  status?: StatusCadastro;
  quadrimestre: "Q1" | "Q2" | "Q3";
  ano: number;
};

async function resolverFiltroEquipe(usuario: UsuarioSessao, equipeIdFiltro?: string) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  if (equipeIdRestrito) return equipeIdRestrito;
  return equipeIdFiltro || undefined;
}

function filtroStatus(status?: StatusCadastro) {
  if (status === "com_erro") return { temErro: true };
  if (status === "sem_erro") return { temErro: false };
  return {};
}

async function construirWhere(usuario: UsuarioSessao, filtros: FiltrosAtendimento): Promise<Prisma.AtendimentoWhereInput> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  const { inicio, fim } = intervaloQuadrimestre(filtros.quadrimestre, filtros.ano);
  return {
    ...(equipeId ? { equipeId } : { ...(filtros.tipoEquipe ? { equipe: { tipo: filtros.tipoEquipe } } : {}) }),
    ...filtroStatus(filtros.status),
    dataAtendimento: { gte: inicio, lte: fim },
  };
}

export type ResumoAtendimentos = {
  total: number;
  meta: number;
  percentualMeta: number | null;
  porTipoEquipe: Record<TipoEquipe, number>;
  comErro: number;
  semErro: number;
  principaisTiposErro: { tipoErro: string; rotulo: string; contagem: number }[];
};

// requisito 13: produção clínica consolidada do período, segmentada por tipo de equipe (dado
// 100% confiável) em vez de por categoria profissional via CBO — ver docs/esus-fdw.md sobre a
// resolução parcial de profissional individual nos atendimentos sincronizados do e-SUS.
export async function obterResumoAtendimentos(
  usuario: UsuarioSessao,
  filtros: FiltrosAtendimento,
): Promise<ResumoAtendimentos> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  const where = await construirWhere(usuario, filtros);

  const tipos: TipoEquipe[] = ["ESF", "EAP", "EMULTI", "ESB"];
  const [total, comErro, porTipo, erros, profissionaisAtivos] = await Promise.all([
    prisma.atendimento.count({ where }),
    prisma.atendimento.count({ where: { ...where, temErro: true } }),
    Promise.all(
      tipos.map((tipo) =>
        prisma.atendimento.count({
          where: { ...where, equipe: { tipo, ...(equipeId ? { id: equipeId } : {}) } },
        }),
      ),
    ),
    prisma.atendimento.groupBy({ by: ["tipoErro"], where: { ...where, temErro: true }, _count: { _all: true } }),
    prisma.profissional.count({
      where: {
        ativo: true,
        ehAcs: false,
        ...(equipeId ? { equipeId } : filtros.tipoEquipe ? { equipe: { tipo: filtros.tipoEquipe } } : {}),
      },
    }),
  ]);

  const porTipoEquipe = Object.fromEntries(tipos.map((tipo, i) => [tipo, porTipo[i]])) as Record<TipoEquipe, number>;
  const principaisTiposErro = erros
    .filter((e) => e.tipoErro)
    .map((e) => ({ tipoErro: e.tipoErro as string, rotulo: ROTULO_ERRO[e.tipoErro as string] ?? e.tipoErro!, contagem: e._count._all }))
    .sort((a, b) => b.contagem - a.contagem);

  // meta operacional de referência: valor configurável (não é um contrato/meta oficial pactuada),
  // proporcional aos 4 meses do quadrimestre — mesma lógica/aviso já usado em listarMetaPorEquipe.
  const meta = META_MENSAL_POR_PROFISSIONAL * Math.max(profissionaisAtivos, 1) * 4;

  return {
    total,
    meta,
    percentualMeta: meta > 0 ? Math.round((total / meta) * 1000) / 10 : null,
    porTipoEquipe,
    comErro,
    semErro: total - comErro,
    principaisTiposErro,
  };
}

export type DesempenhoEquipe = {
  equipeId: string;
  nome: string;
  tipo: TipoEquipe;
  atendimentos: number;
  profissionaisAtivos: number;
  meta: number;
  percentualMeta: number | null;
  comErro: number;
  principaisTiposErro: { tipoErro: string; rotulo: string; contagem: number }[];
  cbosEnvolvidos: string[];
};

// requisito 13/20: produção e conformidade por equipe (não por profissional nomeado — ver
// obterResumoAtendimentos acima para o porquê).
export async function listarDesempenhoPorEquipe(
  usuario: UsuarioSessao,
  filtros: FiltrosAtendimento,
): Promise<DesempenhoEquipe[]> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  const where = await construirWhere(usuario, filtros);

  const equipes = await prisma.equipe.findMany({
    where: {
      ativo: true,
      ...(equipeId ? { id: equipeId } : filtros.tipoEquipe ? { tipo: filtros.tipoEquipe } : {}),
    },
    select: {
      id: true,
      nome: true,
      tipo: true,
      _count: { select: { profissionais: { where: { ativo: true, ehAcs: false } } } },
    },
    orderBy: { nome: "asc" },
  });

  const resultado = await Promise.all(
    equipes.map(async (eq) => {
      const whereEquipe = { ...where, equipeId: eq.id };
      const [atendimentos, comErro, erros, cbos] = await Promise.all([
        prisma.atendimento.count({ where: whereEquipe }),
        prisma.atendimento.count({ where: { ...whereEquipe, temErro: true } }),
        prisma.atendimento.groupBy({ by: ["tipoErro"], where: { ...whereEquipe, temErro: true }, _count: { _all: true } }),
        prisma.atendimento.groupBy({ by: ["cbo"], where: whereEquipe, _count: { _all: true } }),
      ]);

      const meta = META_MENSAL_POR_PROFISSIONAL * Math.max(eq._count.profissionais, 1) * 4;
      const principaisTiposErro = erros
        .filter((e) => e.tipoErro)
        .map((e) => ({ tipoErro: e.tipoErro as string, rotulo: ROTULO_ERRO[e.tipoErro as string] ?? e.tipoErro!, contagem: e._count._all }))
        .sort((a, b) => b.contagem - a.contagem);

      return {
        equipeId: eq.id,
        nome: eq.nome,
        tipo: eq.tipo,
        atendimentos,
        profissionaisAtivos: eq._count.profissionais,
        meta,
        percentualMeta: meta > 0 ? Math.round((atendimentos / meta) * 1000) / 10 : null,
        comErro,
        principaisTiposErro,
        cbosEnvolvidos: cbos.filter((c) => c.cbo).map((c) => c.cbo as string),
      };
    }),
  );

  // equipes com atividade (atendimento ou profissional ativo) primeiro, mais erros primeiro.
  return resultado
    .filter((r) => r.atendimentos > 0 || r.profissionaisAtivos > 0)
    .sort((a, b) => b.comErro - a.comErro || b.atendimentos - a.atendimentos);
}
