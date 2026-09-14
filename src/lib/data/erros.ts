// requisito 12: sugestão de solução por tipo de erro identificado (requisito 11/15).
// Compartilhado entre cadastros e atendimentos — os `tipo_erro` são os mesmos códigos
// atribuídos por sql/06_deteccao_erros.sql em ambas as tabelas.
export const SUGESTOES_ERRO: Record<string, string> = {
  cns_invalido: "Confira o CNS do cidadão no e-SUS PEC — deve ter 15 dígitos numéricos.",
  data_futura: "A data está no futuro; corrija a data no e-SUS PEC ou verifique o relógio do equipamento usado no cadastro.",
  duplicado: "Existe mais de um cadastro para este cidadão nesta equipe (mesmo CNS, CPF ou DNV); mantenha apenas o mais recente e desative os demais no e-SUS PEC.",
  duplicado_provavel:
    "Outro cadastro com o mesmo nome existe nesta equipe, mas com CNS/CPF/DNV diferente — comum quando o ACS cadastra a mesma pessoa duas vezes com documentos diferentes. Confira no e-SUS PEC se é a mesma pessoa antes de desativar um dos registros; nomes iguais também podem ser pessoas distintas.",
  endereco_incompleto: "Complete o endereço de referência do domicílio no e-SUS PEC (rua, número/referência).",
  tipo_nao_informado: "O tipo de atendimento não foi preenchido no e-SUS PEC; edite o atendimento e selecione o tipo correto.",
};

export const ROTULO_ERRO: Record<string, string> = {
  cns_invalido: "CNS inválido",
  data_futura: "Data de registro no futuro",
  duplicado: "Cadastro duplicado",
  duplicado_provavel: "Possível cadastro duplicado",
  endereco_incompleto: "Endereço incompleto",
  tipo_nao_informado: "Tipo não informado",
};
