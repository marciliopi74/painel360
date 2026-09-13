import type { Quadrimestre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// requisito 3: um cidadão só é visível se o cadastro mais recente dele pertence a uma equipe que
// o usuário pode ver — evita vazar CNS/nome de gente de outra equipe pra um profissional.
export async function obterCidadao(usuario: UsuarioSessao, cns: string) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);

  return prisma.cadastroIndividual.findFirst({
    where: { cidadaoCns: cns, ...(equipeIdRestrito ? { equipeId: equipeIdRestrito } : {}) },
    include: {
      profissional: { select: { nome: true, ehAcs: true } },
      equipe: { select: { id: true, nome: true, tipo: true } },
    },
    orderBy: { atualizadoEm: "desc" },
  });
}

export type CriterioPrevine = {
  indicadorId: string;
  indicadorCodigo: string;
  indicadorNome: string;
  criterioCodigo: string;
  criterioDescricao: string;
  atingiu: boolean;
};

// requisito 21: progresso real por critério do Previne Brasil (C2-C7) para esta pessoa —
// mesma tabela usada no drill-down de /indicadores-qualidade, agora filtrada por cidadão.
export async function listarCriteriosPrevine(cns: string, quadrimestre: Quadrimestre, ano: number): Promise<CriterioPrevine[]> {
  const pontuacoes = await prisma.boaPraticaPontuacaoPessoa.findMany({
    where: { cidadaoCns: cns, quadrimestre, ano },
    include: { criterio: true, indicador: { select: { id: true, codigo: true, nome: true } } },
    orderBy: [{ indicador: { codigo: "asc" } }, { criterio: { codigoCriterio: "asc" } }],
  });

  return pontuacoes.map((p) => ({
    indicadorId: p.indicador.id,
    indicadorCodigo: p.indicador.codigo,
    indicadorNome: p.indicador.nome,
    criterioCodigo: p.criterio.codigoCriterio,
    criterioDescricao: p.criterio.descricao,
    atingiu: p.atingiu,
  }));
}
