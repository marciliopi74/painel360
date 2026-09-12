import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// requisito 12: sugestão de solução por tipo de erro identificado (requisito 11/15).
export const SUGESTOES_ERRO: Record<string, string> = {
  cns_invalido: "Confira o CNS do cidadão no e-SUS PEC — deve ter 15 dígitos numéricos.",
  data_futura: "A data está no futuro; corrija a data no e-SUS PEC ou verifique o relógio do equipamento usado no cadastro.",
  duplicado: "Existe mais de um cadastro para este cidadão nesta equipe; mantenha apenas o mais recente e desative os demais no e-SUS PEC.",
  endereco_incompleto: "Complete o endereço de referência do domicílio no e-SUS PEC (rua, número/referência).",
  tipo_nao_informado: "O tipo de atendimento não foi preenchido no e-SUS PEC; edite o atendimento e selecione o tipo correto.",
};

export async function listarCadastrosIndividuais(usuario: UsuarioSessao, apenasComErro = false) {
  const equipeId = await equipeIdPermitido(usuario);
  return prisma.cadastroIndividual.findMany({
    where: { ...(equipeId ? { equipeId } : {}), ...(apenasComErro ? { temErro: true } : {}) },
    include: { profissional: { select: { nome: true, ehAcs: true } }, equipe: { select: { nome: true, tipo: true } } },
    orderBy: { atualizadoEm: "desc" },
    take: 200,
  });
}

export async function listarCadastrosDomiciliares(usuario: UsuarioSessao, apenasComErro = false) {
  const equipeId = await equipeIdPermitido(usuario);
  return prisma.cadastroDomiciliar.findMany({
    where: { ...(equipeId ? { equipeId } : {}), ...(apenasComErro ? { temErro: true } : {}) },
    include: { profissional: { select: { nome: true, ehAcs: true } }, equipe: { select: { nome: true, tipo: true } } },
    orderBy: { atualizadoEm: "desc" },
    take: 200,
  });
}
