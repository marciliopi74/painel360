import type { Quadrimestre } from "@prisma/client";

// requisito 23: Q1 jan-abr, Q2 mai-ago, Q3 set-dez.
export function quadrimestreAtual(referencia = new Date()): { quadrimestre: Quadrimestre; ano: number } {
  const mes = referencia.getMonth() + 1;
  const quadrimestre: Quadrimestre = mes <= 4 ? "Q1" : mes <= 8 ? "Q2" : "Q3";
  return { quadrimestre, ano: referencia.getFullYear() };
}
