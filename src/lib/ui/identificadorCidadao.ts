import { formatarCpf } from "@/lib/ui/cpf";

// Um cadastro individual pode não ter CNS ainda (2026-09-14: cidadaoCns virou nullable) — nesses
// casos usa-se CPF, e na falta dele o DNV (Declaração de Nascido Vivo, recém-nascidos ainda sem
// CPF/CNS) como identificador alternativo pra busca, exibição e link para /cidadao/[x]. Ordem de
// prioridade única (CNS > CPF > DNV) usada em toda tela que precisa mostrar/linkar "o"
// identificador de um cadastro individual — ver cadastros/page.tsx, api/cadastros/exportar e
// cidadao/[cns]/page.tsx.
export type IdentificadorCidadao = { rotulo: "CNS" | "CPF" | "DNV"; bruto: string; exibicao: string };

export function identificadorCidadao(cadastro: {
  cidadaoCns: string | null;
  cidadaoCpf: string | null;
  cidadaoDnv: string | null;
}): IdentificadorCidadao | null {
  if (cadastro.cidadaoCns) return { rotulo: "CNS", bruto: cadastro.cidadaoCns, exibicao: cadastro.cidadaoCns };
  if (cadastro.cidadaoCpf) return { rotulo: "CPF", bruto: cadastro.cidadaoCpf, exibicao: formatarCpf(cadastro.cidadaoCpf) };
  if (cadastro.cidadaoDnv) return { rotulo: "DNV", bruto: cadastro.cidadaoDnv, exibicao: cadastro.cidadaoDnv };
  return null;
}
