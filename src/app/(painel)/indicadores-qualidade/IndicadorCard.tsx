import Link from "next/link";
import { Icon } from "@/components/Icon";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import type { IndicadorMunicipal } from "@/lib/data/indicadores";
import type { ResultadoListaNominalIndicador } from "@/lib/data/listaNominal";
import { DetalheMetodologico } from "@/components/indicadores/DetalheMetodologico";
import { ListaNominalIndicador } from "./ListaNominalIndicador";

export function IndicadorCard({
  indicador,
  expandido,
  hrefExpandir,
  hrefRecolher,
  listaNominal,
  escopoDrillDown,
}: {
  indicador: IndicadorMunicipal;
  expandido: boolean;
  hrefExpandir: string;
  hrefRecolher: string;
  listaNominal: ResultadoListaNominalIndicador | null;
  escopoDrillDown: string;
}) {
  const r = indicador.resultado;
  const cor = r?.classificacao ? CLASSIFICACAO[r.classificacao] : null;
  // requisito do usuário (2026-09-13): botão "Ver lista nominal" em TODOS os 15 indicadores
  // (C1-C7, B1-B6, M1-M2), não só nos "boa_pratica_pontuada" — ver
  // listarListaNominalPorIndicador em src/lib/data/listaNominal.ts para os 3 formatos reais
  // usados (boa_pratica / pessoa_evento / evento) conforme como cada indicador é calculado.
  const podeDetalhar = r !== null;
  const sufixo = indicador.unidadeMedida === "percentual" ? "%" : "";

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden transition-shadow duration-150 ${
        expandido ? "border-2 border-primary-container" : "border border-outline-variant/60 hover:border-primary-container/60"
      }`}
    >
      <div className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-primary text-on-primary text-label-md font-bold">{indicador.codigo}</span>
            <h4 className="text-label-lg text-on-surface font-semibold">{indicador.nome}</h4>
          </div>
          {cor ? (
            <span className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-bold ${cor.fundo} ${cor.texto}`}>
              <span className={`w-2 h-2 rounded-full ${cor.ponto}`} />
              {cor.rotulo}
            </span>
          ) : (
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-sm font-semibold bg-surface-container text-on-surface-variant">
              Sem apuração
            </span>
          )}
        </div>

        {r === null ? (
          <p className="text-body-sm text-on-surface-variant py-2">Nenhuma equipe deste eixo apurou este indicador no período.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center py-2">
              <div>
                <span className="text-label-sm text-on-surface-variant block">Percentual Alcançado</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${cor?.texto ?? "text-on-surface"}`}>
                    {r.valorCalculado}
                    {sufixo}
                  </span>
                  {indicador.parametroBomMin !== null && (
                    <span className="text-label-sm text-on-surface-variant font-medium">
                      (Meta: {indicador.parametroBomMin}
                      {sufixo})
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-label-sm text-on-surface-variant block">Base de Cálculo</span>
                <span className="text-body-md text-on-surface font-medium">
                  {r.numerador.toLocaleString("pt-BR")} de {r.denominador.toLocaleString("pt-BR")} · {r.equipesApuradas}{" "}
                  {r.equipesApuradas === 1 ? "equipe apurada" : "equipes apuradas"}
                </span>
              </div>
              <div className="flex sm:justify-end">
                {podeDetalhar && (
                  <Link
                    href={expandido ? hrefRecolher : hrefExpandir}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-surface-container text-primary text-label-md font-bold hover:bg-surface-variant transition-colors"
                  >
                    <Icon name="person_search" className="text-body-md" />
                    Ver Lista Nominal{r.elegiveis !== null ? ` (${r.elegiveis.toLocaleString("pt-BR")} elegíveis)` : ""}
                    <Icon name={expandido ? "expand_less" : "expand_more"} className="text-body-sm" />
                  </Link>
                )}
              </div>
            </div>
            <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden mt-1 mb-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cor?.barra ?? "bg-primary-container"}`}
                style={{ width: `${Math.min(100, Math.max(0, r.valorCalculado))}%` }}
              />
            </div>
          </>
        )}

        <div className="mt-3">
          <DetalheMetodologico
            formulaNumerador={indicador.formulaNumerador}
            formulaDenominador={indicador.formulaDenominador}
            bandas={indicador.bandas}
            unidadeMedida={indicador.unidadeMedida}
            classificacaoAtual={r?.classificacao ?? null}
            valorAtual={r?.valorCalculado ?? null}
          />
        </div>

        {expandido && podeDetalhar && (
          <div className="mt-4 pt-4 border-t border-outline-variant/60 bg-surface-bright rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-1">
              <div className="flex items-center gap-2">
                <Icon name="assignment_ind" className="text-primary text-body-md" />
                <span className="text-label-md font-bold text-on-surface">Lista Nominal — {escopoDrillDown}</span>
              </div>
              {listaNominal && <span className="text-label-sm text-on-surface-variant">{listaNominal.linhas.length} registro(s)</span>}
            </div>
            {listaNominal ? <ListaNominalIndicador dados={listaNominal} /> : <p className="text-body-sm text-on-surface-variant">Carregando...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
