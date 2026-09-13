import { Icon } from "@/components/Icon";
import { formatarBytes, type RelatorioListado } from "@/lib/data/relatorios";
import { formatarDataHora } from "@/lib/ui/data";

const CONFIG_TIPO: Record<string, { titulo: string; icone: string; cor: string }> = {
  diario: { titulo: "Relatório diário", icone: "today", cor: "bg-surface-container-low text-primary" },
  semanal: { titulo: "Relatório semanal", icone: "date_range", cor: "bg-surface-container-low text-primary" },
  quadrimestral: { titulo: "Avaliação quadrimestral", icone: "event_note", cor: "bg-[#E8F4F5] text-primary" },
};

export function RelatorioItem({ relatorio }: { relatorio: RelatorioListado }) {
  const config = CONFIG_TIPO[relatorio.tipo];

  return (
    <article className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 md:p-5 shadow-sm hover:border-primary-container/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg shrink-0 mt-0.5 ${config.cor}`}>
          <Icon name={config.icone} className="text-headline-sm" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-headline-sm text-on-surface truncate">
              {config.titulo} — {relatorio.periodoReferencia}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-body-sm text-on-surface-variant mt-1">
            <span className="inline-flex items-center gap-1">
              <Icon name="schedule" className="text-body-md text-outline" />
              Gerado: {formatarDataHora(relatorio.geradoEm)}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-semibold text-on-surface">
              <Icon name="description" className="text-body-md text-primary" />
              HTML{relatorio.tamanhoBytes !== null ? ` (${formatarBytes(relatorio.tamanhoBytes)})` : ""}
            </span>
          </div>
        </div>
      </div>
      {relatorio.arquivoUrl && (
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <a
            href={relatorio.arquivoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-on-surface text-label-md transition-colors duration-150 active:scale-95"
          >
            <Icon name="visibility" className="text-body-lg" />
            Visualizar
          </a>
          <a
            href={relatorio.arquivoUrl}
            download
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary-container text-label-md font-semibold shadow-sm transition-colors duration-150 active:scale-95"
          >
            <Icon name="download" className="text-body-lg" />
            Baixar
          </a>
        </div>
      )}
    </article>
  );
}
