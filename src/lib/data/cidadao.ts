import type { Quadrimestre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// requisito 3: um cidadão só é visível se o cadastro mais recente dele pertence a uma equipe que
// o usuário pode ver — evita vazar CNS/nome de gente de outra equipe pra um profissional.
// `identificador` casa com cidadaoCns, cidadaoCpf OU cidadaoDnv: desde 2026-09-14 um cadastro pode
// ter só CPF ou só DNV (recém-nascido), sem CNS ainda emitido/vinculado no e-SUS — ver comentário
// em CadastroIndividual no schema.
export async function obterCidadao(usuario: UsuarioSessao, identificador: string) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);

  return prisma.cadastroIndividual.findFirst({
    where: {
      OR: [{ cidadaoCns: identificador }, { cidadaoCpf: identificador }, { cidadaoDnv: identificador }],
      ...(equipeIdRestrito ? { equipeId: equipeIdRestrito } : {}),
    },
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
// ATENÇÃO: cns aqui precisa ser o CNS REAL (CadastroIndividual.cidadaoCnsReal), não
// CadastroIndividual.cidadaoCns (que é o hash de tb_cds_cad_individual.nu_cns_cidadao, em outro
// espaço de identificador — ver comentário no schema). boas_praticas_pontuacao_pessoa sempre usa
// o CNS real, resolvido via cidadaos_vinculados_equipe()/tb_cidadao.nu_cns.
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
