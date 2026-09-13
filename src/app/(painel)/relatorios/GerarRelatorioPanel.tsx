"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

const OPCOES = [
  { tipo: "diario", rotulo: "Diário", icone: "today" },
  { tipo: "semanal", rotulo: "Semanal", icone: "date_range" },
  { tipo: "quadrimestral", rotulo: "Avaliação Quadrimestral", icone: "event_note" },
] as const;

export function GerarRelatorioPanel({ podeGerar }: { podeGerar: boolean }) {
  const router = useRouter();
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar(tipo: string) {
    setGerando(tipo);
    setErro(null);
    try {
      const resp = await fetch("/api/relatorios/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo }),
      });
      if (!resp.ok) {
        const corpo = await resp.json();
        setErro(typeof corpo.erro === "string" ? corpo.erro : "Falha ao gerar relatório.");
        return;
      }
      router.refresh();
    } finally {
      setGerando(null);
    }
  }

  if (!podeGerar) {
    return (
      <p className="text-body-sm text-on-primary-container">
        Seu papel tem acesso somente leitura aos relatórios já gerados — apenas gestor local, secretário e coordenador podem gerar sob
        demanda.
      </p>
    );
  }

  return (
    <div className="relative z-10 pt-6 flex flex-wrap items-center gap-3">
      {OPCOES.map((op) => (
        <button
          key={op.tipo}
          onClick={() => gerar(op.tipo)}
          disabled={gerando !== null}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest text-primary text-label-md font-bold hover:bg-surface-container-low shadow-sm transition-all duration-150 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name={op.icone} className={`text-body-lg ${gerando === op.tipo ? "sync-spinning" : ""}`} />
          {gerando === op.tipo ? "Gerando..." : `Gerar ${op.rotulo}`}
        </button>
      ))}
      {erro && <p className="text-label-sm text-white bg-error/80 px-3 py-1.5 rounded-lg">{erro}</p>}
    </div>
  );
}
