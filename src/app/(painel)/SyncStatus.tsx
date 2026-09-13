"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

type StatusSincronizacao = "em_andamento" | "concluida" | "erro" | "parcial";

type Sincronizacao = {
  id: string;
  status: StatusSincronizacao;
  iniciadoEm: string;
  concluidoEm: string | null;
  erroMensagem: string | null;
} | null;

function formatarRelativo(data: Date, agora: Date): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - data.getTime()) / 60000));
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.round(horas / 24)} d`;
}

export function SyncStatus({
  ultimaSincronizacao,
  podeDisparar,
}: {
  ultimaSincronizacao: Sincronizacao;
  podeDisparar: boolean;
}) {
  const [sincronizacao, setSincronizacao] = useState(ultimaSincronizacao);
  const [carregando, setCarregando] = useState(false);
  const [agora, setAgora] = useState(() => new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const relogio = setInterval(() => setAgora(new Date()), 30000);
    return () => clearInterval(relogio);
  }, []);

  const pararPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => () => pararPolling(), []);

  async function disparar() {
    setCarregando(true);
    try {
      const resp = await fetch("/api/sincronizacao", { method: "POST" });
      if (!resp.ok) {
        const erro = await resp.json();
        alert(erro.erro ?? "Falha ao iniciar sincronização");
        return;
      }
      const { id } = await resp.json();
      setSincronizacao({ id, status: "em_andamento", iniciadoEm: new Date().toISOString(), concluidoEm: null, erroMensagem: null });
      pararPolling();
      intervalRef.current = setInterval(async () => {
        const r = await fetch(`/api/sincronizacao/${id}`);
        if (!r.ok) return;
        const dados = await r.json();
        setSincronizacao(dados);
        if (dados.status !== "em_andamento") pararPolling();
      }, 2000);
    } finally {
      setCarregando(false);
    }
  }

  const emAndamento = sincronizacao?.status === "em_andamento" || carregando;
  const erro = sincronizacao?.status === "erro";

  const referencia = sincronizacao?.concluidoEm ?? sincronizacao?.iniciadoEm;
  const rotuloStatus = !sincronizacao
    ? "Nunca sincronizado"
    : emAndamento
      ? "Sincronizando…"
      : erro
        ? "Falha na última sincronização"
        : `Última sync: ${formatarRelativo(new Date(referencia!), agora)}`;

  return (
    <div className="flex items-center gap-3">
      <div className="hidden lg:flex flex-col items-end text-right mr-1">
        <div className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
          <span>{rotuloStatus}</span>
          {!emAndamento && sincronizacao && !erro && <span className="font-semibold text-secondary">•&nbsp;OK</span>}
        </div>
        <div className="w-36 h-1.5 bg-surface-container rounded-full overflow-hidden mt-1">
          <div
            className={`h-full rounded-full transition-all ${erro ? "bg-error" : "bg-secondary"}`}
            style={{ width: emAndamento ? "60%" : "100%" }}
          />
        </div>
      </div>
      {podeDisparar && (
        <button
          onClick={disparar}
          disabled={emAndamento}
          className="inline-flex items-center space-x-2 bg-primary hover:bg-primary-container text-on-primary px-3.5 py-2 rounded-lg text-label-md transition-colors duration-150 active:scale-95 shadow-sm disabled:opacity-75 disabled:cursor-not-allowed"
        >
          <Icon name="sync" className={`text-label-lg ${emAndamento ? "sync-spinning" : ""}`} />
          <span className="hidden sm:inline">{emAndamento ? "Sincronizando..." : "Sincronizar agora"}</span>
        </button>
      )}
    </div>
  );
}
