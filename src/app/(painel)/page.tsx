import { auth } from "@/lib/auth";
import { obterResumoDashboard } from "@/lib/data/dashboard";

const NOME_TIPO: Record<string, string> = {
  ESF: "Equipe de Saúde da Família (ESF)",
  EAP: "Equipe de Atenção Primária (eAP)",
  EMULTI: "Equipe Multiprofissional (eMulti)",
  ESB: "Equipe de Saúde Bucal (eSB)",
};

export default async function DashboardPage() {
  const session = await auth();
  const resumo = await obterResumoDashboard(session!.user);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Painel inicial</h1>
        <p className="text-sm text-zinc-500">Cadastros, visitas de ACS, atendimentos e metas por tipo de equipe.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {resumo.map((r) => (
          <div key={r.tipo} className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium text-zinc-500">{NOME_TIPO[r.tipo]}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500">Cadastros individuais</dt>
                <dd className="text-lg font-semibold text-zinc-900">{r.cadastrosIndividuais}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Visitas de ACS</dt>
                <dd className="text-lg font-semibold text-zinc-900">{r.visitasAcs}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Atendimentos</dt>
                <dd className="text-lg font-semibold text-zinc-900">{r.atendimentos}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Meta atingida</dt>
                <dd className="text-lg font-semibold text-zinc-900">
                  {r.percentualMetaAtingida === null ? "—" : `${r.percentualMetaAtingida}%`}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
