"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type OpcaoEquipe = { id: string; nome: string; tipo: string };

export function FiltrosPendencias({
  buscaInicial,
  equipeSelecionada,
  tipoErroSelecionado,
  opcoesEquipe,
  categorias,
  total,
}: {
  buscaInicial: string;
  equipeSelecionada: string;
  tipoErroSelecionado: string;
  opcoesEquipe: OpcaoEquipe[];
  categorias: { tipoErro: string; rotulo: string; contagem: number }[];
  total: number;
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

  useEffect(() => {
    if (busca === buscaInicial) return;
    const timeout = setTimeout(() => navegar({ busca: busca || null }), 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  return (
    <section className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-sm flex flex-col gap-3.5">
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
        <div className="flex-1 relative">
          <Icon name="search" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-body-lg" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNS, endereço ou CBO..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface rounded-lg border border-outline-variant/60 text-body-md text-on-surface focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all"
          />
        </div>
        {opcoesEquipe.length > 1 && (
          <select
            value={equipeSelecionada}
            onChange={(e) => navegar({ equipe: e.target.value || null })}
            className="w-full md:w-56 py-2.5 px-3 bg-surface rounded-lg border border-outline-variant/60 text-label-md text-on-surface focus:outline-none focus:border-primary-container"
          >
            <option value="">Todas as Equipes</option>
            {opcoesEquipe.map((eq) => (
              <option key={eq.id} value={eq.id}>
                {eq.nome} ({eq.tipo})
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto pt-1 border-t border-outline-variant/20">
        <button
          onClick={() => navegar({ tipoErro: null })}
          className={`px-3.5 py-1.5 rounded-full text-label-md whitespace-nowrap transition-all ${
            !tipoErroSelecionado ? "bg-primary-container text-on-primary-container shadow-sm font-bold" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
          }`}
        >
          Todos os Erros ({total.toLocaleString("pt-BR")})
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.tipoErro}
            onClick={() => navegar({ tipoErro: cat.tipoErro })}
            className={`px-3.5 py-1.5 rounded-full text-label-md whitespace-nowrap transition-all ${
              tipoErroSelecionado === cat.tipoErro ? "bg-primary-container text-on-primary-container shadow-sm font-bold" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {cat.rotulo} ({cat.contagem.toLocaleString("pt-BR")})
          </button>
        ))}
      </div>
    </section>
  );
}
