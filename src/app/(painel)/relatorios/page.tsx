import { prisma } from "@/lib/prisma";

const ROTULO_TIPO: Record<string, string> = { diario: "Diário", semanal: "Semanal", quadrimestral: "Quadrimestral" };

export default async function RelatoriosPage() {
  const relatorios = await prisma.relatorioGerado.findMany({ orderBy: { geradoEm: "desc" }, take: 50 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Relatórios</h1>
        <p className="text-sm text-zinc-500">
          Gerados automaticamente: diário e semanal, e avaliação ao final de cada quadrimestre (Q1, Q2, Q3).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 px-3">Gerado em</th>
              <th className="py-2 px-3">Tipo</th>
              <th className="py-2 px-3">Período</th>
              <th className="py-2 px-3">Arquivo</th>
            </tr>
          </thead>
          <tbody>
            {relatorios.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-zinc-400">
                  Nenhum relatório gerado ainda.
                </td>
              </tr>
            )}
            {relatorios.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100">
                <td className="py-2 px-3">{r.geradoEm.toLocaleString("pt-BR")}</td>
                <td className="py-2 px-3">{ROTULO_TIPO[r.tipo]}</td>
                <td className="py-2 px-3">{r.periodoReferencia}</td>
                <td className="py-2 px-3">
                  {r.arquivoUrl ? (
                    <a href={r.arquivoUrl} target="_blank" className="text-zinc-900 underline">
                      Abrir
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
