import type { Quadrimestre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// Componente Vínculo e Acompanhamento Territorial (Nota Técnica nº 30/2025-CGESCO/DESCO/SAPS/MS)
// — ver sql/11_vinculo_acompanhamento.sql para a metodologia completa e as aproximações
// conscientes (documentadas ali, decididas com o usuário em 2026-09-13) usadas por não haver,
// nesta instalação do e-SUS, alguns dos dados que a Nota Técnica pressupõe (CadÚnico, Meu SUS
// Digital, vínculo pessoa↔domicílio).

export async function obterPopulacaoMunicipio(): Promise<number | null> {
  const config = await prisma.configuracaoSistema.findUnique({ where: { id: 1 } });
  return config?.populacaoMunicipio ?? null;
}

export async function atualizarPopulacaoMunicipio(populacao: number): Promise<void> {
  await prisma.configuracaoSistema.upsert({
    where: { id: 1 },
    create: { id: 1, populacaoMunicipio: populacao },
    update: { populacaoMunicipio: populacao },
  });
}

export type ResultadoEquipe = {
  equipeId: string;
  equipeNome: string;
  equipeTipo: "ESF" | "EAP";
  pessoasCadastroValido: number;
  parametroPorte: number;
  resultadoCadastro: number;
  escoreCadastro: number;
  classificacaoCadastro: "otimo" | "bom" | "suficiente" | "regular";
  acompanhadosSemCriterio: number;
  acompanhadosIdosoOuCrianca: number;
  acompanhadosBpcPbf: number;
  acompanhadosIdosoCriancaBpcPbf: number;
  resultadoAcompanhamento: number;
  escoreAcompanhamentoBase: number;
  bonusSatisfacao: number;
  escoreAcompanhamento: number;
  classificacaoAcompanhamento: "otimo" | "bom" | "suficiente" | "regular";
  escoreFinal: number;
  classificacaoFinal: "otimo" | "bom" | "suficiente" | "regular";
  calculadoEm: Date;
  percentualAvaliacoes: number | null;
};

export async function listarResultadosVinculoAcompanhamento(
  usuario: UsuarioSessao,
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<ResultadoEquipe[]> {
  const equipeId = await equipeIdPermitido(usuario);

  const resultados = await prisma.resultadoVinculoAcompanhamento.findMany({
    where: { quadrimestre, ano, equipe: { tipo: { in: ["ESF", "EAP"] }, ...(equipeId ? { id: equipeId } : {}) } },
    include: { equipe: { select: { nome: true, tipo: true } } },
    orderBy: { equipe: { nome: "asc" } },
  });

  const satisfacoes = await prisma.satisfacaoEquipe.findMany({
    where: { quadrimestre, ano, equipeId: { in: resultados.map((r) => r.equipeId) } },
  });
  const satisfacaoPorEquipe = new Map(satisfacoes.map((s) => [s.equipeId, Number(s.percentualAvaliacoes)]));

  return resultados.map((r) => ({
    equipeId: r.equipeId,
    equipeNome: r.equipe.nome,
    equipeTipo: r.equipe.tipo as "ESF" | "EAP",
    pessoasCadastroValido: r.pessoasCadastroValido,
    parametroPorte: r.parametroPorte,
    resultadoCadastro: Number(r.resultadoCadastro),
    escoreCadastro: Number(r.escoreCadastro),
    classificacaoCadastro: r.classificacaoCadastro,
    acompanhadosSemCriterio: r.acompanhadosSemCriterio,
    acompanhadosIdosoOuCrianca: r.acompanhadosIdosoOuCrianca,
    acompanhadosBpcPbf: r.acompanhadosBpcPbf,
    acompanhadosIdosoCriancaBpcPbf: r.acompanhadosIdosoCriancaBpcPbf,
    resultadoAcompanhamento: Number(r.resultadoAcompanhamento),
    escoreAcompanhamentoBase: Number(r.escoreAcompanhamentoBase),
    bonusSatisfacao: Number(r.bonusSatisfacao),
    escoreAcompanhamento: Number(r.escoreAcompanhamento),
    classificacaoAcompanhamento: r.classificacaoAcompanhamento,
    escoreFinal: Number(r.escoreFinal),
    classificacaoFinal: r.classificacaoFinal,
    calculadoEm: r.calculadoEm,
    percentualAvaliacoes: satisfacaoPorEquipe.get(r.equipeId) ?? null,
  }));
}

export async function atualizarSatisfacaoEquipe(equipeId: string, quadrimestre: Quadrimestre, ano: number, percentual: number): Promise<void> {
  await prisma.satisfacaoEquipe.upsert({
    where: { equipeId_quadrimestre_ano: { equipeId, quadrimestre, ano } },
    create: { equipeId, quadrimestre, ano, percentualAvaliacoes: percentual },
    update: { percentualAvaliacoes: percentual },
  });
}

export type BeneficiarioVulneravel = { id: string; cidadaoCns: string; cidadaoNome: string | null; atualizadoEm: Date };

export async function listarBeneficiariosVulneraveis(): Promise<BeneficiarioVulneravel[]> {
  return prisma.beneficiarioVulneravel.findMany({ orderBy: { atualizadoEm: "desc" } });
}

export async function adicionarBeneficiarioVulneravel(cidadaoCns: string, cidadaoNome: string | null): Promise<void> {
  await prisma.beneficiarioVulneravel.upsert({
    where: { cidadaoCns },
    create: { cidadaoCns, cidadaoNome },
    update: { cidadaoNome },
  });
}

export async function removerBeneficiarioVulneravel(id: string): Promise<void> {
  await prisma.beneficiarioVulneravel.delete({ where: { id } });
}
