import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { equipeIdPermitido } from "@/lib/data/escopo";

export default async function AlertasPage() {
  const session = await auth();
  const equipeId = await equipeIdPermitido(session!.user);

  const alertas = await prisma.alerta.findMany({
    where: equipeId ? { profissional: { equipeId } } : {},
    include: {
      profissional: { select: { nome: true, usuarios: { select: { telefone: true }, take: 1 } } },
      indicador: { select: { codigo: true, nome: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 100,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Alertas</h1>
        <p className="text-sm text-zinc-500">
          Disparados quando um indicador fica classificado como Regular ou abaixo do mínimo esperado.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 px-3">Criado em</th>
              <th className="py-2 px-3">Profissional</th>
              <th className="py-2 px-3">Indicador</th>
              <th className="py-2 px-3">Mensagem</th>
              <th className="py-2 px-3">SMS</th>
            </tr>
          </thead>
          <tbody>
            {alertas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-400">
                  Nenhum alerta.
                </td>
              </tr>
            )}
            {alertas.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 align-top">
                <td className="py-2 px-3">{a.criadoEm.toLocaleString("pt-BR")}</td>
                <td className="py-2 px-3">
                  {a.profissional.nome}
                  <div className="text-xs text-zinc-400">{a.profissional.usuarios[0]?.telefone ?? "sem telefone"}</div>
                </td>
                <td className="py-2 px-3">{a.indicador.codigo}</td>
                <td className="py-2 px-3">{a.mensagem}</td>
                <td className="py-2 px-3">
                  {a.enviadoSms ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Enviado
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Pendente
                    </span>
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
