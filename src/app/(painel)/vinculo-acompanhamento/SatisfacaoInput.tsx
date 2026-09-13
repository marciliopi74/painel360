"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Quadrimestre } from "@prisma/client";

export function SatisfacaoInput({
  equipeId,
  quadrimestre,
  ano,
  valorAtual,
}: {
  equipeId: string;
  quadrimestre: Quadrimestre;
  ano: number;
  valorAtual: number | null;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(valorAtual?.toString() ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const percentual = Number(valor);
    if (Number.isNaN(percentual) || percentual < 0 || percentual > 100) return;
    setSalvando(true);
    try {
      await fetch("/api/vinculo-acompanhamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "satisfacao", equipeId, quadrimestre, ano, percentual }),
      });
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        max={100}
        step="0.1"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={salvar}
        disabled={salvando}
        placeholder="—"
        className="w-16 h-7 px-1.5 rounded border border-outline-variant/60 bg-surface text-on-surface text-label-sm text-center focus:outline-none focus:border-primary-container"
      />
      <span className="text-label-sm text-on-surface-variant">%</span>
    </div>
  );
}
