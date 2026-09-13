"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type OpcaoEquipe = { id: string; nome: string; tipo: string };

export function FiltrosCadastros({
  buscaInicial,
  equipeSelecionada,
  opcoesEquipe,
  contagens,
}: {
  buscaInicial: string;
  equipeSelecionada: string;
  opcoesEquipe: OpcaoEquipe[];
  contagens: { todos: number; comErro: number; semErro: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [busca, setBusca] = useState(buscaInicial);

  function navegar(atualizacoes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [chave, valor] of Object.entries(atualizacoes)) {
      if (valor) params.set(chave, valor);
      else params.delete(chave);
    }
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  // debounce da busca por texto — evita disparar uma navegação a cada tecla.
  useEffect(() => {
    if (busca === buscaInicial) return;
    const timeout = setTimeout(() => navegar({ busca: busca || null }), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const statusAtual = searchParams.get("status") ?? "todos";

  const CHIPS: { valor: string; rotulo: string; contagem: number; ponto?: string; cor: string }[] = [
    { valor: "todos", rotulo: "Todos", contagem: contagens.todos, cor: "bg-surface-container text-primary font-bold" },
    {
      valor: "com_erro",
      rotulo: "Com Erro",
      contagem: contagens.comErro,
      ponto: "bg-error",
      cor: "bg-error-container text-on-error-container font-semibold",
    },
    {
      valor: "sem_erro",
      rotulo: "Sem Erro",
      contagem: contagens.semErro,
      ponto: "bg-secondary",
      cor: "bg-surface-container-low text-secondary font-medium",
    },
  ];

  return (
    <section className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-body-lg" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cidadão, endereço, CNS ou nome do ACS..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent text-body-sm transition"
          />
        </div>
        {opcoesEquipe.length > 1 && (
          <div className="w-full sm:w-56">
            <label className="sr-only" htmlFor="filtro-equipe">
              Filtrar por Equipe
            </label>
            <div className="relative">
              <Icon name="groups" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-body-md" />
              <select
                id="filtro-equipe"
                value={equipeSelecionada}
                onChange={(e) => navegar({ equipe: e.target.value || null })}
                className="w-full pl-9 pr-8 py-2.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-transparent appearance-none"
              >
                <option value="">Todas as Equipes</option>
                {opcoesEquipe.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome} ({eq.tipo})
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline pointer-events-none text-body-md"
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-outline-variant/20">
        <span className="text-label-sm text-on-surface-variant font-semibold uppercase pr-2 shrink-0">Exibir:</span>
        {CHIPS.map((chip) => (
          <button
            key={chip.valor}
            onClick={() => navegar({ status: chip.valor === "todos" ? null : chip.valor })}
            className={`px-3.5 py-1.5 rounded-full text-label-md transition-all whitespace-nowrap flex items-center gap-1.5 ${
              statusAtual === chip.valor ? chip.cor + " shadow-sm" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {chip.ponto && <span className={`w-2 h-2 rounded-full ${chip.ponto}`} />}
            {chip.rotulo} ({chip.contagem.toLocaleString("pt-BR")})
          </button>
        ))}
      </div>
    </section>
  );
}
