import type { Classificacao, UnidadeMedida } from "@prisma/client";
import { Icon } from "@/components/Icon";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import { formatarFaixasParametro, type BandasIndicador } from "@/lib/data/indicadores";

// Componente único e reutilizável para os dois blocos padronizados das Notas Metodológicas
// oficiais — "Fórmula de Cálculo" (numerador/denominador) e "Parâmetro" (4 faixas de
// classificação) — usado em qualquer tela que mostre um indicador (Indicadores de Qualidade,
// Visão da Equipe, ...). Só recebe dados já estruturados (nunca texto solto formatado à mão), e
// deriva as faixas sempre dos mesmos parametro*Min/Max reais usados pelo motor de cálculo — não
// há um segundo texto de faixas que possa ficar desatualizado em relação ao valor real.
export function DetalheMetodologico({
  formulaNumerador,
  formulaDenominador,
  bandas,
  unidadeMedida,
  classificacaoAtual,
  valorAtual,
}: {
  formulaNumerador: string | null;
  formulaDenominador: string | null;
  bandas: BandasIndicador;
  unidadeMedida: UnidadeMedida;
  classificacaoAtual: Classificacao | null;
  valorAtual: number | null;
}) {
  const faixas = formatarFaixasParametro(bandas, unidadeMedida);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* Fórmula de Cálculo */}
      <div className="rounded-lg border border-outline-variant/40 bg-surface p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon name="function" className="text-primary text-body-md" />
          <span className="text-label-sm font-bold uppercase tracking-wide text-primary">Fórmula de Cálculo</span>
        </div>
        {formulaNumerador && formulaDenominador ? (
          <dl className="space-y-2 text-body-sm">
            <div>
              <dt className="text-label-sm font-bold text-on-surface-variant uppercase">Numerador</dt>
              <dd className="text-on-surface">{formulaNumerador}</dd>
            </div>
            <div className="pt-2 border-t border-outline-variant/20">
              <dt className="text-label-sm font-bold text-on-surface-variant uppercase">Denominador</dt>
              <dd className="text-on-surface">{formulaDenominador}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-body-sm text-on-surface-variant">Fórmula de cálculo ainda não cadastrada para este indicador.</p>
        )}
      </div>

      {/* Parâmetro */}
      <div className="rounded-lg border border-outline-variant/40 bg-surface p-3.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Icon name="rule" className="text-primary text-body-md" />
          <span className="text-label-sm font-bold uppercase tracking-wide text-primary">Parâmetro</span>
        </div>
        {faixas ? (
          <div className="grid grid-cols-2 gap-2">
            {faixas.map((faixa) => {
              const cor = CLASSIFICACAO[faixa.classificacao];
              const ativa = classificacaoAtual === faixa.classificacao;
              return (
                <div
                  key={faixa.classificacao}
                  className={`rounded-lg p-2.5 border-2 transition-all ${cor.fundo} ${ativa ? `${cor.borda} shadow-sm` : "border-transparent"}`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-label-sm font-bold flex items-center gap-1 ${cor.texto}`}>
                      <span className={`w-2 h-2 rounded-full ${cor.ponto}`} />
                      {faixa.rotulo}
                    </span>
                    {ativa && (
                      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white ${cor.texto}`}>
                        <Icon name="my_location" className="text-[11px]" />
                        Atual
                      </span>
                    )}
                  </div>
                  <span className="text-body-sm text-on-surface font-medium block mt-0.5">{faixa.intervalo}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-body-sm text-on-surface-variant">Faixas de classificação ainda não cadastradas para este indicador.</p>
        )}
        {valorAtual !== null && (
          <p className="text-label-sm text-on-surface-variant mt-2">
            Resultado atual: <strong className="text-on-surface">{valorAtual}{unidadeMedida === "percentual" ? "%" : ""}</strong>
          </p>
        )}
      </div>
    </div>
  );
}
