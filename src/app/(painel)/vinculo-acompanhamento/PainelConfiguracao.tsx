"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { BeneficiarioVulneravel } from "@/lib/data/vinculoAcompanhamento";

async function chamar(corpo: object) {
  const resp = await fetch("/api/vinculo-acompanhamento", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const erro = await resp.json().catch(() => ({}));
    throw new Error(erro.erro ? JSON.stringify(erro.erro) : "Falha na operação");
  }
}

export function PainelConfiguracao({ populacaoAtual, beneficiarios }: { populacaoAtual: number | null; beneficiarios: BeneficiarioVulneravel[] }) {
  const router = useRouter();
  const [populacao, setPopulacao] = useState(populacaoAtual?.toString() ?? "");
  const [cns, setCns] = useState("");
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvarPopulacao() {
    const valor = Number(populacao);
    if (!Number.isInteger(valor) || valor <= 0) {
      setErro("Informe um número inteiro positivo de habitantes.");
      return;
    }
    setErro(null);
    setCarregando(true);
    try {
      await chamar({ acao: "populacao", populacao: valor });
      router.refresh();
    } catch {
      setErro("Falha ao salvar a população.");
    } finally {
      setCarregando(false);
    }
  }

  async function adicionarBeneficiario() {
    if (!cns.trim()) return;
    setErro(null);
    setCarregando(true);
    try {
      await chamar({ acao: "adicionar_beneficiario", cidadaoCns: cns.trim(), cidadaoNome: nome.trim() || null });
      setCns("");
      setNome("");
      router.refresh();
    } catch {
      setErro("Falha ao adicionar beneficiário.");
    } finally {
      setCarregando(false);
    }
  }

  async function removerBeneficiario(id: string) {
    setCarregando(true);
    try {
      await chamar({ acao: "remover_beneficiario", id });
      router.refresh();
    } catch {
      setErro("Falha ao remover beneficiário.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm p-5 space-y-5">
      <div>
        <h3 className="text-label-lg font-bold text-on-surface flex items-center gap-2">
          <Icon name="tune" className="text-primary text-body-md" />
          Dados manuais (fora do e-SUS)
        </h3>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          A Nota Técnica 30 usa 3 dados que não existem nesta instalação do e-SUS (vêm do IBGE, CadÚnico e do app Meu SUS Digital) — preencha
          aqui para que o cálculo os considere.
        </p>
      </div>

      {erro && <p className="text-label-sm text-error">{erro}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-label-sm text-on-surface-variant block mb-1">População do município (IBGE)</label>
          <input
            type="number"
            min={1}
            value={populacao}
            onChange={(e) => setPopulacao(e.target.value)}
            className="w-44 h-9 px-2.5 rounded-lg border border-outline-variant/60 bg-surface text-on-surface text-label-md focus:outline-none focus:border-primary-container"
          />
        </div>
        <button
          onClick={salvarPopulacao}
          disabled={carregando}
          className="h-9 px-4 rounded-lg bg-primary-container text-on-primary text-label-md font-semibold hover:bg-primary transition-colors disabled:opacity-50"
        >
          Salvar
        </button>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <h4 className="text-label-md font-bold text-on-surface mb-1">Beneficiários Bolsa Família / BPC</h4>
        <p className="text-label-sm text-on-surface-variant mb-2">
          Cadastre pelo CNS real do cidadão (Cartão SUS) — precisa ser o CNS de verdade, não o número que aparece na tela de Cadastros.
        </p>
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <input
            placeholder="CNS (15 dígitos)"
            value={cns}
            onChange={(e) => setCns(e.target.value)}
            className="w-48 h-9 px-2.5 rounded-lg border border-outline-variant/60 bg-surface text-on-surface text-label-md font-mono focus:outline-none focus:border-primary-container"
          />
          <input
            placeholder="Nome (opcional)"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-56 h-9 px-2.5 rounded-lg border border-outline-variant/60 bg-surface text-on-surface text-label-md focus:outline-none focus:border-primary-container"
          />
          <button
            onClick={adicionarBeneficiario}
            disabled={carregando || !cns.trim()}
            className="h-9 px-4 rounded-lg bg-surface-container text-primary text-label-md font-semibold hover:bg-surface-variant transition-colors disabled:opacity-50"
          >
            <Icon name="add" className="text-body-md" />
          </button>
        </div>
        {beneficiarios.length === 0 ? (
          <p className="text-label-sm text-on-surface-variant/70">Nenhum beneficiário cadastrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {beneficiarios.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-surface-container text-label-sm text-on-surface">
                <span className="font-mono">{b.cidadaoCns}</span>
                {b.cidadaoNome && <span className="text-on-surface-variant">· {b.cidadaoNome}</span>}
                <button onClick={() => removerBeneficiario(b.id)} className="text-on-surface-variant hover:text-error" title="Remover">
                  <Icon name="close" className="text-body-sm" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
