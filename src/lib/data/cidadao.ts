import { Prisma, type Quadrimestre } from "@prisma/client";
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

export type ResumoAtualizacaoCadastro = {
  totalCadastros: number;
  ultimaAtualizacao: Date;
};

// Nota Técnica 30, item sobre "cadastro atualizado": uma pessoa pode ter mais de um cadastro
// individual na mesma equipe (ACS cadastrando a mesma pessoa 2x — às vezes uma ficha só com CPF,
// outra só com Cartão SUS/DNV, ver requisito de detecção de duplicados pedido pelo usuário em
// 2026-09-14). A "última atualização" de verdade dessa pessoa é a mais recente entre TODOS os
// cadastros dela, não só o registro que a página abriu. Usa a MESMA regra de "mesma pessoa" que
// detectar_erros_cadastros() (sql/06) usa pra achar duplicados: identificador exato em comum
// (CNS, CPF ou DNV) OU nome idêntico na mesma equipe — uma heurística por nome quando não há
// identificador em comum, não uma certeza. Só lê e agrega; não funde nem altera nenhum registro.
//
// Cadastro DOMICILIAR/territorial deliberadamente NÃO entra aqui: não existe, nesta instalação,
// nenhum vínculo entre um cadastro individual e o domicílio da pessoa (tb_cds_cad_individual não
// referencia o domicílio — mesma limitação já documentada em sql/11_vinculo_acompanhamento.sql),
// então não há como saber qual cadastro domiciliar pertence a esta pessoa especificamente.
export async function obterAtualizacaoCadastroIndividual(cadastro: {
  equipeId: string;
  dataCadastro: Date;
  cidadaoCns: string | null;
  cidadaoCpf: string | null;
  cidadaoDnv: string | null;
  cidadaoNome: string | null;
}): Promise<ResumoAtualizacaoCadastro> {
  const condicoes: Prisma.CadastroIndividualWhereInput[] = [];
  if (cadastro.cidadaoCns) condicoes.push({ cidadaoCns: cadastro.cidadaoCns });
  if (cadastro.cidadaoCpf) condicoes.push({ cidadaoCpf: cadastro.cidadaoCpf });
  if (cadastro.cidadaoDnv) condicoes.push({ cidadaoDnv: cadastro.cidadaoDnv });
  if (cadastro.cidadaoNome) condicoes.push({ cidadaoNome: { equals: cadastro.cidadaoNome, mode: "insensitive" } });

  // todo cadastro sincronizado tem ao menos um identificador (ver WHERE em sql/03_sync_functions.sql),
  // então `condicoes` nunca fica vazio na prática — se ficasse (dado malformado), evita uma busca
  // sem filtro nenhum (que traria a equipe inteira) e devolve só o próprio registro.
  if (condicoes.length === 0) return { totalCadastros: 1, ultimaAtualizacao: cadastro.dataCadastro };

  const relacionados = await prisma.cadastroIndividual.findMany({
    where: { equipeId: cadastro.equipeId, OR: condicoes },
    select: { dataCadastro: true },
  });

  return {
    totalCadastros: relacionados.length,
    ultimaAtualizacao: relacionados.map((r) => r.dataCadastro).reduce((max, d) => (d > max ? d : max)),
  };
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
