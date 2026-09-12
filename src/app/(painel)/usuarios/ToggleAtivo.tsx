"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ativo ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
      }`}
    >
      {ativo ? "Ativo" : "Inativo"}
    </button>
  );
}
