import { auth } from "@/lib/auth";
import { listarAtendimentosPorProfissional, listarMetaPorEquipe } from "@/lib/data/atendimentos";
import { prisma } from "@/lib/prisma";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { SUGESTOES_ERRO } from "@/lib/data/cadastros";

export default async function AtendimentosPage() {
  const session = await auth();
  const usuario = session!.user;

  const [porProfissional, metaPorEquipe, equipeId] = await Promise.all([
    listarAtendimentosPorProfissional(usuario),
    listarMetaPorEquipe(usuario),
    equipeIdPermitido(usuario),
  ]);

  const comErro = await prisma.atendimento.findMany({
    where: { temErro: true, ...(equipeId ? { equipeId } : {}) },
    include: { equipe: { select: { nome: true } } },
    orderBy: { atualizadoEm: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Atendimentos</h1>
        <p className="text-sm text-zinc-500">
          Volume por profissional, percentual de meta atingida por equipe e erros identificados.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Meta mensal por equipe</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">Equipe</th>
              <th className="py-2 pr-3">Atendimentos no mês</th>
              <th className="py-2 pr-3">Meta</th>
              <th className="py-2 pr-3">% atingido</th>
            </tr>
          </thead>
          <tbody>
            {metaPorEquipe.map((m) => (
              <tr key={m.equipeId} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{m.nomeEquipe}</td>
                <td className="py-2 pr-3">{m.atendimentosNoMes}</td>
                <td className="py-2 pr-3">{m.metaEquipe}</td>
                <td className="py-2 pr-3 font-medium">{m.percentualMetaAtingida}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Atendimentos por profissional</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Só inclui atendimentos com profissional identificado (lançamentos manuais); atendimentos
          sincronizados do e-SUS são contabilizados por equipe acima.
        </p>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">Profissional</th>
              <th className="py-2 pr-3">Equipe</th>
              <th className="py-2 pr-3">Atendimentos</th>
            </tr>
          </thead>
          <tbody>
            {porProfissional.length === 0 && (
              <tr>
                <td colSpan={3} className="py-4 text-center text-zinc-400">
                  Nenhum atendimento com profissional identificado.
                </td>
              </tr>
            )}
            {porProfissional.map((p) => (
              <tr key={p.profissionalId} className="border-b border-zinc-100">
                <td className="py-2 pr-3">{p.nome}</td>
                <td className="py-2 pr-3">{p.equipe}</td>
                <td className="py-2 pr-3">{p.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Atendimentos com erro</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">Equipe</th>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Erro / sugestão</th>
            </tr>
          </thead>
          <tbody>
            {comErro.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-zinc-400">
                  Nenhum atendimento com erro.
                </td>
              </tr>
            )}
            {comErro.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 align-top">
                <td className="py-2 pr-3">{a.equipe.nome}</td>
                <td className="py-2 pr-3">{a.dataAtendimento.toLocaleDateString("pt-BR")}</td>
                <td className="py-2 pr-3">{a.tipoAtendimento}</td>
                <td className="py-2 pr-3">
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                    {a.tipoErro}
                  </span>
                  {a.tipoErro && SUGESTOES_ERRO[a.tipoErro] && (
                    <p className="mt-1 text-xs text-zinc-500">{SUGESTOES_ERRO[a.tipoErro]}</p>
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
