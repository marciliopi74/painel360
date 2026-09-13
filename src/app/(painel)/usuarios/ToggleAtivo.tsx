"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";

export function ToggleAtivo({ id, ativo }: { id: string; ativo: boolean }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);

  async function alternar() {
    setCarregando(true);
    try {
      await fetch(`/api/usuarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: !ativo }),
      });
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <button
      onClick={alternar}
      disabled={carregando}
      title={ativo ? "Clique para desativar" : "Clique para ativar"}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        ativo ? "bg-secondary-container/40 text-secondary hover:bg-secondary-container/60" : "bg-surface-container text-on-surface-variant hover:bg-surface-variant"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ativo ? "bg-secondary" : "bg-outline"}`} />
      {carregando ? <Icon name="hourglass_top" className="text-[13px] sync-spinning" /> : ativo ? "Ativo" : "Inativo"}
    </button>
  );
}
