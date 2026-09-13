import type { TipoEquipe } from "@prisma/client";

export const ICONE_TIPO: Record<TipoEquipe, string> = {
  ESF: "groups",
  EAP: "medical_services",
  EMULTI: "diversity_1",
  ESB: "dentistry",
};

export const NOME_TIPO_CURTO: Record<TipoEquipe, string> = {
  ESF: "ESF",
  EAP: "eAP",
  EMULTI: "eMULTI",
  ESB: "eSB",
};

export const NOME_TIPO_COMPLETO: Record<TipoEquipe, string> = {
  ESF: "Estratégia Saúde da Família",
  EAP: "Equipe de Atenção Primária",
  EMULTI: "Equipe Multiprofissional",
  ESB: "Saúde Bucal",
};
