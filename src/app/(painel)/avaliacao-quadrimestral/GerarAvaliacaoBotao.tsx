"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Quadrimestre } from "@prisma/client";
import { Icon } from "@/components/Icon";

export function GerarAvaliacaoBotao({ quadrimestre, ano }: { quadrimestre: Quadrimestre; ano: number }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gerar() {
    setCarregando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/relatorios/gerar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "quadrimestral", quadrimestre, ano }),
      });
      if (!resp.ok) {
        const corpo = await resp.json();
        setErro(typeof corpo.erro === "string" ? corpo.erro : "Falha ao gerar avaliação.");
        return;
      }
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={gerar}
        disabled={carregando}
        className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-label-lg font-bold hover:bg-primary-container transition-colors shadow-sm active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <Icon name="description" className={carregando ? "sync-spinning" : ""} />
        {carregando ? "Gerando..." : "Gerar Relatório da Avaliação"}
      </button>
      {erro && <p className="text-label-sm text-error">{erro}</p>}
    </div>
  );
}
