import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ROTULO_ERRO, SUGESTOES_ERRO } from "@/lib/data/cadastros";

function Titulo({ titulo, linkCns }: { titulo: string; linkCns?: string }) {
  if (linkCns) {
    return (
      <Link href={`/cidadao/${encodeURIComponent(linkCns)}`} className="text-headline-sm font-bold text-on-surface truncate hover:underline hover:text-primary">
        {titulo}
      </Link>
    );
  }
  return <h3 className="text-headline-sm font-bold text-on-surface truncate">{titulo}</h3>;
}

export function FichaCard({
  icone,
  iconeOk,
  titulo,
  linkCns,
  detalhe,
  acs,
  equipe,
  temErro,
  tipoErro,
}: {
  icone: string;
  iconeOk: string;
  titulo: string;
  linkCns?: string;
  detalhe: string;
  acs: string;
  equipe: string;
  temErro: boolean;
  tipoErro: string | null;
}) {
  if (temErro) {
    const rotulo = tipoErro ? (ROTULO_ERRO[tipoErro] ?? tipoErro) : "Inconsistência";
    const sugestao = tipoErro ? SUGESTOES_ERRO[tipoErro] : null;
    return (
      <div className="bg-[#FEECEB] border-2 border-[#E5533C] rounded-xl p-5 shadow-sm transition hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-[#FDF0ED] border border-[#E5533C]/30 flex items-center justify-center text-error shrink-0 mt-0.5">
              <Icon name={icone} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Titulo titulo={titulo} linkCns={linkCns} />
                <span className="px-2.5 py-0.5 rounded-full bg-[#FDF0ED] border border-[#E5533C]/40 text-[#B8321D] text-label-sm font-bold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E5533C]" />
                  {rotulo}
                </span>
              </div>
              <p className="text-body-sm text-on-surface-variant mt-1">{detalhe}</p>
              <div className="flex items-center gap-2 mt-2 text-label-md text-on-surface-variant flex-wrap">
                <Icon name="badge" className="text-body-md text-primary" />
                <span>
                  ACS: <strong className="text-on-surface">{acs}</strong>
                </span>
                <span className="text-outline">•</span>
                <span>
                  Equipe: <strong className="text-on-surface">{equipe}</strong>
                </span>
              </div>
            </div>
          </div>
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

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#EAF8F1] border border-[#2FBF71]/30 flex items-center justify-center text-secondary shrink-0 mt-0.5">
            <Icon name={iconeOk} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Titulo titulo={titulo} linkCns={linkCns} />
              <span className="px-2.5 py-0.5 rounded-full bg-[#EAF8F1] border border-[#2FBF71]/30 text-[#1E824C] text-label-sm font-semibold flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF71]" />
                Validado
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1">{detalhe}</p>
            <div className="flex items-center gap-2 mt-2 text-label-md text-on-surface-variant flex-wrap">
              <Icon name="badge" className="text-body-md text-primary" />
              <span>
                ACS: <strong className="text-on-surface">{acs}</strong>
              </span>
              <span className="text-outline">•</span>
              <span>
                Equipe: <strong className="text-on-surface">{equipe}</strong>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <span className="text-secondary flex items-center gap-1 text-label-md font-semibold px-3 py-1.5 rounded-lg bg-[#EAF8F1]">
            <Icon name="task_alt" className="text-label-lg" />
            Conforme
          </span>
        </div>
      </div>
    </div>
  );
}
