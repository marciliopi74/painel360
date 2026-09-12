"use client";

import { useEffect, useRef, useState } from "react";

const ETAPAS = ["equipes", "profissionais", "atendimentos", "cadastros_individuais", "cadastros_domiciliares", "concluido"];

type Sincronizacao = {
  id: string;
  status: "em_andamento" | "concluida" | "erro" | "parcial";
  etapaAtual: string | null;
  processados: number;
  erroMensagem: string | null;
};

export function BotaoSincronizar({ podeDisparar }: { podeDisparar: boolean }) {
  const [sincronizacao, setSincronizacao] = useState<Sincronizacao | null>(null);
  const [carregando, setCarregando] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  const iniciarPolling = (id: string) => {
    pararPolling();
    intervalRef.current = setInterval(async () => {
      const resp = await fetch(`/api/sincronizacao/${id}`);
      if (!resp.ok) return;
      const dados: Sincronizacao = await resp.json();
      setSincronizacao(dados);
      if (dados.status !== "em_andamento") pararPolling();
    }, 2000);
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
      setSincronizacao({ id, status: "em_andamento", etapaAtual: null, processados: 0, erroMensagem: null });
      iniciarPolling(id);
    } finally {
      setCarregando(false);
    }
  }

  const indiceEtapa = sincronizacao?.etapaAtual ? ETAPAS.indexOf(sincronizacao.etapaAtual) : -1;
  const percentual = indiceEtapa >= 0 ? Math.round(((indiceEtapa + 1) / ETAPAS.length) * 100) : 0;
  const emAndamento = sincronizacao?.status === "em_andamento";

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Sincronização manual</h2>
          <p className="text-sm text-zinc-500">Busca os dados mais recentes do e-SUS sob demanda.</p>
        </div>
        <button
          onClick={disparar}
          disabled={!podeDisparar || carregando || emAndamento}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {emAndamento ? "Sincronizando..." : "Sincronizar agora"}
        </button>
      </div>

      {!podeDisparar && (
        <p className="mt-3 text-xs text-zinc-400">Seu papel não tem permissão para disparar sincronizações.</p>
      )}

      {sincronizacao && (
        <div className="mt-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all ${
                sincronizacao.status === "erro" ? "bg-red-500" : "bg-zinc-900"
              }`}
              style={{ width: `${sincronizacao.status === "concluida" ? 100 : percentual}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-zinc-500">
            {sincronizacao.status === "concluida" && "Sincronização concluída."}
            {sincronizacao.status === "erro" && `Erro: ${sincronizacao.erroMensagem}`}
            {sincronizacao.status === "em_andamento" &&
              `Etapa atual: ${sincronizacao.etapaAtual ?? "iniciando"} (${sincronizacao.processados} registros)`}
          </p>
        </div>
      )}
    </div>
  );
}
