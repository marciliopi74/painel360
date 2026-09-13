"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";

const ETAPAS = [
  "equipes",
  "profissionais",
  "atendimentos",
  "cadastros_individuais",
  "cadastros_domiciliares",
  "indicadores_qualidade",
  "vinculo_acompanhamento",
  "concluido",
];
const ROTULO_ETAPA: Record<string, string> = {
  equipes: "Equipes",
  profissionais: "Profissionais",
  atendimentos: "Atendimentos",
  cadastros_individuais: "Cadastros individuais",
  cadastros_domiciliares: "Cadastros domiciliares",
  indicadores_qualidade: "Indicadores de qualidade",
  vinculo_acompanhamento: "Vínculo e acompanhamento",
  concluido: "Concluído",
};

type Sincronizacao = {
  id: string;
  status: "em_andamento" | "concluida" | "erro" | "parcial";
  etapaAtual: string | null;
  processados: number;
  erroMensagem: string | null;
};

export function BotaoSincronizar({ podeDisparar }: { podeDisparar: boolean }) {
  const router = useRouter();
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
      if (dados.status !== "em_andamento") {
        pararPolling();
        router.refresh();
      }
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
  const erro = sincronizacao?.status === "erro";

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-5 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-headline-sm text-on-surface">Sincronização Manual</h2>
          <p className="text-body-sm text-on-surface-variant">Busca os dados mais recentes do e-SUS sob demanda, fora do ciclo automático de 10 em 10 minutos.</p>
        </div>
        <button
          onClick={disparar}
          disabled={!podeDisparar || carregando || emAndamento}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold hover:bg-primary transition-colors duration-150 active:scale-95 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Icon name="autorenew" className={emAndamento || carregando ? "sync-spinning" : ""} />
          {emAndamento ? "Sincronizando..." : "Sincronizar agora"}
        </button>
      </div>

      {!podeDisparar && (
        <p className="mt-3 text-label-sm text-on-surface-variant flex items-center gap-1">
          <Icon name="lock" className="text-body-md" />
          Seu papel não tem permissão para disparar sincronizações.
        </p>
      )}

      {sincronizacao && (
        <div className="mt-4 pt-4 border-t border-outline-variant/30">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container">
            <div
              className={`h-full rounded-full transition-all ${erro ? "bg-error" : "bg-primary-container"}`}
              style={{ width: `${sincronizacao.status === "concluida" ? 100 : percentual}%` }}
            />
          </div>
          <p className="mt-2 text-label-sm text-on-surface-variant flex items-center gap-1.5">
            {sincronizacao.status === "concluida" && (
              <>
                <Icon name="check_circle" className="text-body-md text-secondary" />
                Sincronização concluída — {sincronizacao.processados} registro(s) processado(s).
              </>
            )}
            {erro && (
              <>
                <Icon name="error" className="text-body-md text-error" />
                Erro: {sincronizacao.erroMensagem}
              </>
            )}
            {emAndamento && (
              <>
                <Icon name="sync" className="text-body-md sync-spinning" />
                Etapa atual: {ROTULO_ETAPA[sincronizacao.etapaAtual ?? ""] ?? "iniciando"} ({sincronizacao.processados} registros)
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
