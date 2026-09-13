import type { Quadrimestre } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// requisito 23: Q1 jan-abr, Q2 mai-ago, Q3 set-dez.
export function quadrimestreAtual(referencia = new Date()): { quadrimestre: Quadrimestre; ano: number } {
  const mes = referencia.getMonth() + 1;
  const quadrimestre: Quadrimestre = mes <= 4 ? "Q1" : mes <= 8 ? "Q2" : "Q3";
  return { quadrimestre, ano: referencia.getFullYear() };
}

const MES_INICIO: Record<Quadrimestre, number> = { Q1: 0, Q2: 4, Q3: 8 };
const MES_FIM: Record<Quadrimestre, number> = { Q1: 3, Q2: 7, Q3: 11 };
const ROTULO_MESES: Record<Quadrimestre, string> = { Q1: "jan-abr", Q2: "mai-ago", Q3: "set-dez" };

export function intervaloQuadrimestre(quadrimestre: Quadrimestre, ano: number): { inicio: Date; fim: Date } {
  const inicio = new Date(ano, MES_INICIO[quadrimestre], 1, 0, 0, 0, 0);
  const fim = new Date(ano, MES_FIM[quadrimestre] + 1, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

export function quadrimestreAnterior(quadrimestre: Quadrimestre, ano: number): { quadrimestre: Quadrimestre; ano: number } {
  if (quadrimestre === "Q1") return { quadrimestre: "Q3", ano: ano - 1 };
  if (quadrimestre === "Q2") return { quadrimestre: "Q1", ano };
  return { quadrimestre: "Q2", ano };
}

export function rotuloQuadrimestre(quadrimestre: Quadrimestre, ano: number): string {
  const numero = quadrimestre === "Q1" ? "1º" : quadrimestre === "Q2" ? "2º" : "3º";
  return `${numero} quadrimestre ${ano} (${ROTULO_MESES[quadrimestre]})`;
}

// requisito 20/23: períodos selecionáveis nos painéis — sempre inclui o quadrimestre corrente
// (mesmo sem resultados calculados ainda) e todo período com indicadores já apurados.
export async function listarPeriodosDisponiveis(): Promise<{ quadrimestre: Quadrimestre; ano: number }[]> {
  const atual = quadrimestreAtual();

  const apurados = await prisma.resultadoIndicador.findMany({
    distinct: ["quadrimestre", "ano"],
    select: { quadrimestre: true, ano: true },
  });

  const chave = (q: Quadrimestre, a: number) => `${a}-${q}`;
  const vistos = new Set(apurados.map((p) => chave(p.quadrimestre, p.ano)));
  const periodos = [...apurados];
  if (!vistos.has(chave(atual.quadrimestre, atual.ano))) periodos.push(atual);

  const ordem: Record<Quadrimestre, number> = { Q1: 0, Q2: 1, Q3: 2 };
  return periodos.sort((a, b) => b.ano - a.ano || ordem[b.quadrimestre] - ordem[a.quadrimestre]);
}
