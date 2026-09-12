import { auth } from "@/lib/auth";
import { podeDispararSincronizacao } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { BotaoSincronizar } from "./BotaoSincronizar";

const STATUS_ROTULO: Record<string, string> = {
  em_andamento: "Em andamento",
  concluida: "Concluída",
  erro: "Erro",
  parcial: "Parcial",
};

export default async function SincronizacaoPage() {
  const session = await auth();
  const usuario = session!.user;

  const historico = await prisma.sincronizacao.findMany({
    orderBy: { iniciadoEm: "desc" },
    take: 20,
    include: { usuario: { select: { nome: true } } },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Sincronização com o e-SUS</h1>
        <p className="text-sm text-zinc-500">
          Automática a cada 10 minutos via pg_cron; ou dispare manualmente abaixo.
        </p>
      </div>

      <BotaoSincronizar podeDisparar={podeDispararSincronizacao(usuario)} />

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Histórico</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">Início</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Disparada por</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Registros</th>
            </tr>
          </thead>
          <tbody>
            {historico.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{s.iniciadoEm.toLocaleString("pt-BR")}</td>
                <td className="py-2 pr-3">{s.tipo}</td>
                <td className="py-2 pr-3">{s.usuario.nome}</td>
                <td className="py-2 pr-3">{STATUS_ROTULO[s.status]}</td>
                <td className="py-2 pr-3">{s.processados}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
