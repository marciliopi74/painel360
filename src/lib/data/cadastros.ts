import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

export { SUGESTOES_ERRO, ROTULO_ERRO } from "@/lib/data/erros";

export type StatusCadastro = "todos" | "com_erro" | "sem_erro";

export type FiltrosCadastro = {
  busca?: string;
  equipeId?: string;
  status?: StatusCadastro;
  pagina?: number;
};

export const ITENS_POR_PAGINA = 10;

async function resolverFiltroEquipe(usuario: UsuarioSessao, equipeIdFiltro?: string) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  // usuário restrito a uma equipe (profissional): ignora o filtro da UI, já está travado.
  if (equipeIdRestrito) return equipeIdRestrito;
  return equipeIdFiltro || undefined;
}

function filtroStatus(status?: StatusCadastro) {
  if (status === "com_erro") return { temErro: true };
  if (status === "sem_erro") return { temErro: false };
  return {};
}

export async function construirWhereIndividual(
  usuario: UsuarioSessao,
  filtros: FiltrosCadastro = {},
): Promise<Prisma.CadastroIndividualWhereInput> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  return {
    ...(equipeId ? { equipeId } : {}),
    ...filtroStatus(filtros.status),
    ...(filtros.busca
      ? {
          OR: [
            { cidadaoNome: { contains: filtros.busca, mode: "insensitive" } },
            { cidadaoCns: { contains: filtros.busca, mode: "insensitive" } },
            { profissional: { nome: { contains: filtros.busca, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function construirWhereDomiciliar(
  usuario: UsuarioSessao,
  filtros: FiltrosCadastro = {},
): Promise<Prisma.CadastroDomiciliarWhereInput> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  return {
    ...(equipeId ? { equipeId } : {}),
    ...filtroStatus(filtros.status),
    ...(filtros.busca
      ? {
          OR: [
            { enderecoReferencia: { contains: filtros.busca, mode: "insensitive" } },
            { profissional: { nome: { contains: filtros.busca, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}

export async function listarCadastrosIndividuais(usuario: UsuarioSessao, filtros: FiltrosCadastro = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const where = await construirWhereIndividual(usuario, filtros);

  const [registros, total] = await Promise.all([
    prisma.cadastroIndividual.findMany({
      where,
      include: { profissional: { select: { nome: true, ehAcs: true } }, equipe: { select: { nome: true, tipo: true } } },
      orderBy: { atualizadoEm: "desc" },
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
    }),
    prisma.cadastroIndividual.count({ where }),
  ]);

  return { registros, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / ITENS_POR_PAGINA)) };
}

export async function listarCadastrosDomiciliares(usuario: UsuarioSessao, filtros: FiltrosCadastro = {}) {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const where = await construirWhereDomiciliar(usuario, filtros);

  const [registros, total] = await Promise.all([
    prisma.cadastroDomiciliar.findMany({
      where,
      include: { profissional: { select: { nome: true, ehAcs: true } }, equipe: { select: { nome: true, tipo: true } } },
      orderBy: { atualizadoEm: "desc" },
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
    }),
    prisma.cadastroDomiciliar.count({ where }),
  ]);

  return { registros, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / ITENS_POR_PAGINA)) };
}

export type ResumoCadastros = {
  total: number;
  validos: number;
  comPendencia: number;
};

// requisito: banner de KPIs — contagens reais combinando cadastros individuais e domiciliares,
// sem aplicar busca/paginação (visão geral do território, não da página atual da lista).
export async function obterResumoCadastros(
  usuario: UsuarioSessao,
  filtros: Pick<FiltrosCadastro, "equipeId"> = {},
): Promise<ResumoCadastros> {
  const equipeId = await resolverFiltroEquipe(usuario, filtros.equipeId);
  const filtroEquipe = equipeId ? { equipeId } : {};

  const [totalIndividuais, totalDomiciliares, errosIndividuais, errosDomiciliares] = await Promise.all([
    prisma.cadastroIndividual.count({ where: filtroEquipe }),
    prisma.cadastroDomiciliar.count({ where: filtroEquipe }),
    prisma.cadastroIndividual.count({ where: { ...filtroEquipe, temErro: true } }),
    prisma.cadastroDomiciliar.count({ where: { ...filtroEquipe, temErro: true } }),
  ]);

  const total = totalIndividuais + totalDomiciliares;
  const comPendencia = errosIndividuais + errosDomiciliares;
  return { total, validos: total - comPendencia, comPendencia };
}
