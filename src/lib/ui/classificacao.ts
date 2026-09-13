import type { Classificacao } from "@prisma/client";

// Rótulos e cores visuais para a classificação de um resultadoIndicador (otimo/bom/suficiente/
// regular, já calculada pelo motor de indicadores em sql/04_indicadores_motor_calculo.sql).
// 4 cores distintas (azul/verde/amarelo/vermelho, convenção pedida em 2026-09-13: Ótimo=azul) —
// compartilhado por todas as telas que mostram indicadores (Dashboard, Visão da Equipe,
// Indicadores de Qualidade, Avaliação Quadrimestral) para manter a mesma linguagem visual.
// Ótimo usa um azul fixo (#1D4ED8), não o token `primary` do tema — `primary` aqui é um
// teal-escuro (#00626a) que na prática lê como verde-azulado, não como azul de verdade (o
// usuário apontou isso em 2026-09-13 depois da primeira tentativa reaproveitando `primary`).
export const CLASSIFICACAO: Record<Classificacao, { rotulo: string; texto: string; barra: string; borda: string; ponto: string; fundo: string }> = {
  otimo: {
    rotulo: "Ótimo",
    texto: "text-[#1D4ED8]",
    barra: "bg-[#1D4ED8]",
    borda: "border-[#1D4ED8]",
    ponto: "bg-[#1D4ED8]",
    fundo: "bg-[#EAF1FE]",
  },
  bom: {
    rotulo: "Bom",
    texto: "text-secondary",
    barra: "bg-secondary",
    borda: "border-secondary",
    ponto: "bg-secondary",
    fundo: "bg-[#EAF8F1]",
  },
  suficiente: {
    rotulo: "Suficiente",
    texto: "text-tertiary-container",
    barra: "bg-tertiary-container",
    borda: "border-tertiary-container",
    ponto: "bg-tertiary-container",
    fundo: "bg-[#FEF6EE]",
  },
  regular: { rotulo: "Regular", texto: "text-error", barra: "bg-error", borda: "border-error", ponto: "bg-error", fundo: "bg-error-container" },
};
