import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ROTULO_ERRO, SUGESTOES_ERRO } from "@/lib/data/erros";
import type { Pendencia } from "@/lib/data/pendencias";
import { formatarData } from "@/lib/ui/data";

const CONFIG_ORIGEM: Record<Pendencia["origem"], { icone: string; rotulo: string; href: string }> = {
  individual: { icone: "person_alert", rotulo: "Cadastro Individual", href: "/cadastros" },
  domiciliar: { icone: "home_work", rotulo: "Cadastro Domiciliar", href: "/cadastros" },
  atendimento: { icone: "event_busy", rotulo: "Atendimento", href: "/atendimentos" },
};

// nu_cpf no e-SUS vem só com os 11 dígitos, sem máscara — formata ###.###.###-##. Se por algum
// motivo não vier com exatamente 11 dígitos (dado incompleto/malformado), mostra cru em vez de
// aplicar uma máscara errada.
function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

export function PendenciaCard({ pendencia }: { pendencia: Pendencia }) {
  const origem = CONFIG_ORIGEM[pendencia.origem];
  const rotuloErro = ROTULO_ERRO[pendencia.tipoErro] ?? pendencia.tipoErro;
  const sugestao = SUGESTOES_ERRO[pendencia.tipoErro];

  return (
    <div className="bg-[#FEECEB] border-2 border-[#E5533C] rounded-xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#FDF0ED] border border-[#E5533C]/30 flex items-center justify-center text-error shrink-0 mt-0.5">
            <Icon name={origem.icone} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {pendencia.origem === "individual" && pendencia.cidadaoCnsLink ? (
                <Link href={`/cidadao/${encodeURIComponent(pendencia.cidadaoCnsLink)}`} className="text-headline-sm font-bold text-on-surface truncate hover:underline hover:text-primary">
                  {pendencia.titulo || "—"}
                </Link>
              ) : (
                <h3 className="text-headline-sm font-bold text-on-surface truncate">{pendencia.titulo || "—"}</h3>
              )}
              <span className="px-2.5 py-0.5 rounded-full bg-[#FDF0ED] border border-[#E5533C]/40 text-[#B8321D] text-label-sm font-bold flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E5533C]" />
                {rotuloErro}
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-label-sm shrink-0">{origem.rotulo}</span>
            </div>
            {pendencia.identificador && (
              <p className="text-body-sm text-on-surface-variant mt-1 font-mono">
                {pendencia.usaCpf ? "CPF" : "CNS"}: {pendencia.usaCpf ? formatarCpf(pendencia.identificador) : pendencia.identificador}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 text-label-md text-on-surface-variant flex-wrap">
              {pendencia.profissionalNome && (
                <>
                  <Icon name="badge" className="text-body-md text-primary" />
                  <span>
                    Profissional: <strong className="text-on-surface">{pendencia.profissionalNome}</strong>
                  </span>
                  <span className="text-outline">•</span>
                </>
              )}
              <span>
                Equipe: <strong className="text-on-surface">{pendencia.equipeNome} ({pendencia.equipeTipo})</strong>
              </span>
              <span className="text-outline">•</span>
              <span>Atualizado: {formatarData(pendencia.data)}</span>
            </div>
          </div>
        </div>
        <a
          href={origem.href}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/60 hover:bg-surface-container text-primary text-label-md font-semibold transition shrink-0 self-end md:self-center"
        >
          <Icon name="open_in_new" className="text-body-md" />
          Ver em {origem.rotulo.includes("Atendimento") ? "Atendimentos" : "Cadastros"}
        </a>
      </div>
      {sugestao && (
        <div className="mt-4 pt-3 border-t border-[#E5533C]/20 flex items-start gap-2.5 text-on-surface-variant text-body-sm">
          <span className="text-base leading-none select-none">💡</span>
          <div>
            <strong className="text-[#B8321D]">Sugestão de Correção: </strong>
            <span>{sugestao}</span>
          </div>
        </div>
      )}
    </div>
  );
}
