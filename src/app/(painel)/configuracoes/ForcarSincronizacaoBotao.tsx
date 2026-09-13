"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export function ForcarSincronizacaoBotao() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "em_andamento" | "concluida" | "erro">("idle");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  async function disparar() {
    setStatus("em_andamento");
    const resp = await fetch("/api/sincronizacao", { method: "POST" });
    if (!resp.ok) {
      setStatus("erro");
      return;
    }
    const { id } = await resp.json();
    intervalRef.current = setInterval(async () => {
      const r = await fetch(`/api/sincronizacao/${id}`);
      if (!r.ok) return;
      const dados = await r.json();
      if (dados.status !== "em_andamento") {
        setStatus(dados.status === "concluida" ? "concluida" : "erro");
        if (intervalRef.current) clearInterval(intervalRef.current);
        router.refresh();
      }
    }, 2000);
  }

  return (
    <button
      onClick={disparar}
      disabled={status === "em_andamento"}
      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold hover:bg-primary transition-colors duration-150 active:scale-95 shadow-sm whitespace-nowrap disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <Icon name="autorenew" className={status === "em_andamento" ? "sync-spinning" : ""} />
      {status === "em_andamento" ? "Sincronizando..." : status === "concluida" ? "Concluída!" : status === "erro" ? "Falhou — tentar de novo" : "Forçar Sincronização Completa"}
    </button>
  );
}
