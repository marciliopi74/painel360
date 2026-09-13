import { stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { prisma } from "@/lib/prisma";
import type { TipoRelatorio } from "@prisma/client";
import { RELATORIOS_DIR } from "@/lib/relatorios";

export const ITENS_POR_PAGINA = 8;

export type RelatorioListado = {
  id: string;
  tipo: TipoRelatorio;
  periodoReferencia: string;
  arquivoUrl: string | null;
  geradoEm: Date;
  tamanhoBytes: number | null;
};

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export { formatarBytes };

export async function listarRelatorios(
  filtros: { tipo?: TipoRelatorio; pagina?: number } = {},
): Promise<{ relatorios: RelatorioListado[]; total: number; pagina: number; totalPaginas: number }> {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const where = filtros.tipo ? { tipo: filtros.tipo } : {};

  const [registros, total] = await Promise.all([
    prisma.relatorioGerado.findMany({
      where,
      orderBy: { geradoEm: "desc" },
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
    }),
    prisma.relatorioGerado.count({ where }),
  ]);

  const relatorios = await Promise.all(
    registros.map(async (r) => {
      let tamanhoBytes: number | null = null;
      if (r.arquivoUrl) {
        try {
          const info = await stat(join(RELATORIOS_DIR, basename(r.arquivoUrl)));
          tamanhoBytes = info.size;
        } catch {
          tamanhoBytes = null;
        }
      }
      return { id: r.id, tipo: r.tipo, periodoReferencia: r.periodoReferencia, arquivoUrl: r.arquivoUrl, geradoEm: r.geradoEm, tamanhoBytes };
    }),
  );

  return { relatorios, total, pagina, totalPaginas: Math.max(1, Math.ceil(total / ITENS_POR_PAGINA)) };
}

export async function contarRelatoriosPorTipo(): Promise<Record<TipoRelatorio, number>> {
  const grupos = await prisma.relatorioGerado.groupBy({ by: ["tipo"], _count: { _all: true } });
  const base: Record<TipoRelatorio, number> = { diario: 0, semanal: 0, quadrimestral: 0 };
  for (const g of grupos) base[g.tipo] = g._count._all;
  return base;
}
