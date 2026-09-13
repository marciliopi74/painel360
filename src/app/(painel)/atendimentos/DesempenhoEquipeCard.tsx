import { Icon } from "@/components/Icon";
import type { DesempenhoEquipe } from "@/lib/data/atendimentos";
import { ICONE_TIPO } from "@/lib/ui/tipoEquipe";

export function DesempenhoEquipeCard({ equipe }: { equipe: DesempenhoEquipe }) {
  const temErro = equipe.comErro > 0;
  const percentual = equipe.percentualMeta ?? 0;

  return (
    <article
      className={`bg-surface-container-lowest rounded-xl p-5 border shadow-sm flex flex-col justify-between transition-all duration-150 ${
        temErro ? "border-outline-variant/40 hover:border-error/40" : "border-outline-variant/40 hover:border-primary/40"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-surface-container text-primary flex items-center justify-center shrink-0">
              <Icon name={ICONE_TIPO[equipe.tipo] ?? "groups"} />
            </div>
            <div className="min-w-0">
              <h3 className="text-headline-sm text-on-surface font-semibold truncate">{equipe.nome}</h3>
              <div className="flex items-center gap-1.5 text-label-md text-on-surface-variant mt-0.5">
                <span className="font-medium text-on-surface">{equipe.tipo}</span>
                <span>•</span>
                <span>
                  {equipe.profissionaisAtivos} {equipe.profissionaisAtivos === 1 ? "profissional ativo" : "profissionais ativos"}
                </span>
              </div>
              {equipe.cbosEnvolvidos.length > 0 && (
                <span className="text-label-sm text-outline">CBOs envolvidos: {equipe.cbosEnvolvidos.join(", ")}</span>
              )}
            </div>
          </div>
          {temErro ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FEF6EE] text-[#B25E16] text-label-sm font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F4A261] mr-1.5" />
              Atenção (Erros)
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#EAF8F1] text-[#1E824C] text-label-sm font-semibold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF71] mr-1.5" />
              Sem inconsistências
            </span>
          )}
        </div>

        <div className="p-3.5 rounded-lg bg-surface-container-low/40 border border-outline-variant/20 mb-4">
          <div className="flex items-baseline justify-between mb-1.5 flex-wrap gap-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-on-surface">{equipe.atendimentos.toLocaleString("pt-BR")}</span>
              <span className="text-body-sm text-on-surface-variant">atendimentos no período</span>
            </div>
            <span className={`text-label-md font-bold ${temErro ? "text-primary" : "text-[#1E824C]"}`}>
              {equipe.percentualMeta === null ? "—" : `${equipe.percentualMeta}% da meta`}
            </span>
          </div>
          <div className="w-full h-2.5 bg-surface-variant rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${temErro ? "bg-primary-container" : "bg-[#2FBF71]"}`}
              style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
            />
          </div>
          <div className="flex justify-between text-label-sm text-on-surface-variant mt-1.5">
            <span>Meta de referência: {equipe.meta.toLocaleString("pt-BR")} atendimentos</span>
            {equipe.atendimentos < equipe.meta && <span>Faltam {(equipe.meta - equipe.atendimentos).toLocaleString("pt-BR")}</span>}
          </div>
        </div>

        {temErro ? (
          <div className="rounded-lg p-3 bg-[#FDF0ED] border border-[#E5533C]/30 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#B8321D] font-bold text-label-md">
              <Icon name="error" className="text-body-md" />
              <span>
                {equipe.comErro} {equipe.comErro === 1 ? "atendimento com pendência" : "atendimentos com pendência"}
              </span>
            </div>
            <ul className="space-y-1 pt-0.5 text-label-sm text-on-surface">
              {equipe.principaisTiposErro.map((erro) => (
                <li key={erro.tipoErro} className="flex items-center justify-between bg-white/70 px-2 py-1 rounded border border-[#E5533C]/15">
                  <span className="text-on-surface-variant">{erro.rotulo}</span>
                  <span className="font-semibold text-on-surface">{erro.contagem}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-lg p-3 bg-[#EAF8F1]/60 border border-[#2FBF71]/30 flex items-center gap-2">
            <Icon name="verified_user" className="text-[#1E824C] text-xl" />
            <span className="text-label-md font-bold text-[#1E824C]">100% dos registros sem inconsistência detectada</span>
          </div>
        )}
      </div>
    </article>
  );
}
