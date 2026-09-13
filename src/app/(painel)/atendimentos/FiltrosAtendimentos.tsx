"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";

type OpcaoEquipe = { id: string; nome: string; tipo: string };
type OpcaoPeriodo = { valor: string; rotulo: string };

const TIPOS_EQUIPE = [
  { valor: "", rotulo: "Todos os Tipos" },
  { valor: "ESF", rotulo: "ESF" },
  { valor: "EAP", rotulo: "eAP" },
  { valor: "EMULTI", rotulo: "eMULTI" },
  { valor: "ESB", rotulo: "eSB" },
];

const STATUS = [
  { valor: "", rotulo: "Com e sem pendências" },
  { valor: "com_erro", rotulo: "Somente com inconsistências" },
  { valor: "sem_erro", rotulo: "Registros 100% válidos" },
];

export function FiltrosAtendimentos({
  tipoEquipeSelecionado,
  equipeSelecionada,
  statusSelecionado,
  periodoSelecionado,
  opcoesEquipe,
  opcoesPeriodo,
}: {
  tipoEquipeSelecionado: string;
  equipeSelecionada: string;
  statusSelecionado: string;
  periodoSelecionado: string;
  opcoesEquipe: OpcaoEquipe[];
  opcoesPeriodo: OpcaoPeriodo[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navegar(atualizacoes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(atualizacoes)) {
      if (valor) params.set(chave, valor);
      else params.delete(chave);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const semFiltrosAtivos = !tipoEquipeSelecionado && !equipeSelecionada && !statusSelecionado;

  return (
    <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-5 border border-outline-variant/40 shadow-sm">
      <div className="flex items-center justify-between mb-3.5">
        <div className="flex items-center gap-2">
          <Icon name="tune" className="text-primary text-body-lg" />
          <h2 className="text-label-lg text-on-surface">Filtros Operacionais</h2>
        </div>
        {!semFiltrosAtivos && (
          <button
            onClick={() => router.push(pathname)}
            className="text-label-sm text-primary hover:underline flex items-center gap-1"
          >
            <Icon name="restart_alt" className="text-body-sm" />
            Redefinir Filtros
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-tipo-equipe" className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="groups" className="text-[13px]" />
            Tipo de Equipe
          </label>
          <select
            id="filtro-tipo-equipe"
            value={tipoEquipeSelecionado}
            onChange={(e) => navegar({ tipo: e.target.value || null, equipe: null })}
            className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-body-sm text-on-surface py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container appearance-none"
          >
            {TIPOS_EQUIPE.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-equipe" className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="badge" className="text-[13px]" />
            Equipe
          </label>
          <select
            id="filtro-equipe"
            value={equipeSelecionada}
            onChange={(e) => navegar({ equipe: e.target.value || null })}
            className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-body-sm text-on-surface py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container appearance-none"
          >
            <option value="">Todas as Equipes</option>
            {opcoesEquipe
              .filter((eq) => !tipoEquipeSelecionado || eq.tipo === tipoEquipeSelecionado)
              .map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome} ({eq.tipo})
                </option>
              ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-periodo" className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="calendar_month" className="text-[13px]" />
            Janela Temporal
          </label>
          <select
            id="filtro-periodo"
            value={periodoSelecionado}
            onChange={(e) => navegar({ periodo: e.target.value })}
            className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-body-sm text-on-surface py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container appearance-none"
          >
            {opcoesPeriodo.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtro-status" className="text-label-sm text-on-surface-variant flex items-center gap-1">
            <Icon name="rule" className="text-[13px]" />
            Conformidade e-SUS
          </label>
          <select
            id="filtro-status"
            value={statusSelecionado}
            onChange={(e) => navegar({ status: e.target.value || null })}
            className="w-full bg-surface-container-lowest border border-outline-variant/60 rounded-lg text-body-sm text-on-surface py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container appearance-none"
          >
            {STATUS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
