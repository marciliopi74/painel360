import Link from "next/link";
import type { Quadrimestre, TipoEquipeAlvo } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeDispararSincronizacao } from "@/lib/rbac";
import { Icon } from "@/components/Icon";
import { obterAvaliacaoQuadrimestral } from "@/lib/data/avaliacaoQuadrimestral";
import { quadrimestreAtual, intervaloQuadrimestre, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import { formatarDataHora } from "@/lib/ui/data";
import { SeletorPeriodo } from "../SeletorPeriodo";
import { GerarAvaliacaoBotao } from "./GerarAvaliacaoBotao";

const ROTULO_EIXO: Record<TipoEquipeAlvo, string> = { ESF_EAP: "ESF/eAP", ESB: "eSB", EMULTI: "eMulti" };

export default async function AvaliacaoQuadrimestralPage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const [anoParam, quadParam] = (params.periodo ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();

  const [avaliacao, periodosDisponiveis, relatorioExistente] = await Promise.all([
    obterAvaliacaoQuadrimestral(usuario, periodo.quadrimestre, periodo.ano),
    listarPeriodosDisponiveis(),
    prisma.relatorioGerado.findFirst({
      where: { tipo: "quadrimestral", periodoReferencia: `${periodo.quadrimestre}-${periodo.ano}` },
      orderBy: { geradoEm: "desc" },
    }),
  ]);

  const { fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);
  const diasParaFechamento = Math.ceil((fim.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  const deltaMedia = avaliacao.media !== null && avaliacao.mediaAnterior !== null ? Math.round((avaliacao.media - avaliacao.mediaAnterior) * 10) / 10 : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 rounded bg-surface-container text-primary text-label-sm font-semibold uppercase tracking-wider">
            Atenção Primária à Saúde
          </span>
          <h1 className="text-headline-lg text-on-surface mt-1">Avaliação Quadrimestral</h1>
          <p className="text-body-md text-on-surface-variant">
            Fechamento consolidado dos 15 indicadores oficiais do Previne Brasil (C1-C7, B1-B6, M1-M2) para conferência e comparação com o
            quadrimestre anterior.
          </p>
        </div>
        <SeletorPeriodo
          selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
          periodos={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
        />
      </div>

      {/* Pill de prazo */}
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-surface-container text-primary flex items-center justify-center shrink-0">
            <Icon name="timer" />
          </div>
          <div>
            <span className="text-label-lg text-on-surface block">Janela de Correção de Inconsistências</span>
            <span className="text-body-sm text-on-surface-variant">
              {diasParaFechamento >= 0
                ? `${diasParaFechamento} dia${diasParaFechamento === 1 ? "" : "s"} restantes para o fechamento de ${rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)} (${fim.toLocaleDateString("pt-BR")})`
                : "Este quadrimestre já foi encerrado."}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Média dos Indicadores</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-extrabold text-primary tracking-tight">{avaliacao.media ?? "—"}</span>
              {avaliacao.media !== null && <span className="text-headline-sm text-outline">%</span>}
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Cálculo interno — média simples dos indicadores percentuais apurados; não é o Indicador Sintético Final (ISF) oficial do
              SISAB, que usa pesos por indicador não documentados neste projeto.
            </p>
          </div>
          {deltaMedia !== null && (
            <div className="mt-4 pt-4 border-t border-outline-variant/30 flex items-center justify-between text-label-sm">
              <span className="text-on-surface-variant">vs. {rotuloQuadrimestre(avaliacao.anterior.quadrimestre, avaliacao.anterior.ano)}</span>
              <span className={`font-bold ${deltaMedia >= 0 ? "text-secondary" : "text-error"}`}>
                {deltaMedia >= 0 ? "+" : ""}
                {deltaMedia} pp
              </span>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-5 shadow-sm">
          <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Composição das Metas</span>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Metas Batidas</span>
              <span className="text-headline-sm font-bold text-secondary">{avaliacao.metasBatidas}</span>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Em Alerta</span>
              <span className="text-headline-sm font-bold text-tertiary">{avaliacao.alertas}</span>
            </div>
          </div>
          <p className="text-label-sm text-on-surface-variant mt-2">{avaliacao.apurados} de {avaliacao.indicadores.length} indicadores apurados</p>
        </div>

        <div className="lg:col-span-3 bg-surface-container-lowest border border-outline-variant/50 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">Evolução</span>
          <div className="h-24 flex items-end justify-around gap-4 pt-2">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-label-md font-bold text-on-surface-variant">{avaliacao.mediaAnterior ?? "—"}</span>
              <div
                className="w-full bg-surface-container-high rounded-t-md"
                style={{ height: `${Math.max(4, Math.min(72, (avaliacao.mediaAnterior ?? 0) * 0.72))}px` }}
              />
              <span className="text-label-sm text-outline">{avaliacao.anterior.quadrimestre}/{avaliacao.anterior.ano}</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <span className="text-label-md font-bold text-primary">{avaliacao.media ?? "—"}</span>
              <div
                className="w-full bg-primary-container rounded-t-md"
                style={{ height: `${Math.max(4, Math.min(72, (avaliacao.media ?? 0) * 0.72))}px` }}
              />
              <span className="text-label-sm text-primary font-bold">{periodo.quadrimestre}/{periodo.ano}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nota Final do Componente III (Nota Técnica 6/2025-DEAPS/SAPS/MS) */}
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/40 bg-surface-container-low/40">
          <h2 className="text-headline-sm text-on-surface">Nota Final do Componente III — Qualidade</h2>
          <p className="text-body-sm text-on-surface-variant">
            Soma de peso × conceito por indicador (Nota Técnica nº 6/2025-DEAPS/SAPS/MS), sobre o resultado municipal agregado de cada eixo —
            não é a nota por equipe usada para o repasse financeiro oficial.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant/30">
          {avaliacao.notasFinais.map((nf) => {
            const cor = CLASSIFICACAO[nf.classificacao];
            return (
              <div key={nf.alvo} className="p-5 flex flex-col gap-2">
                <span className="text-label-md text-on-surface-variant uppercase tracking-wider font-semibold">{ROTULO_EIXO[nf.alvo]}</span>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-extrabold tracking-tight ${cor.texto}`}>{nf.nota.toFixed(2)}</span>
                  <span className="text-headline-sm text-outline">/ 10</span>
                </div>
                <span className={`self-start inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-sm font-bold ${cor.fundo} ${cor.texto}`}>
                  <span className={`w-2 h-2 rounded-full ${cor.ponto}`} />
                  {cor.rotulo}
                </span>
                {nf.indicadoresApurados < nf.indicadoresTotal && (
                  <p className="text-label-sm text-tertiary mt-1">
                    {nf.indicadoresApurados} de {nf.indicadoresTotal} indicadores apurados (peso {nf.pesoApurado} de {nf.pesoTotal}) — nota
                    parcial, ainda não fechada.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabela dos 15 indicadores */}
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/40 bg-surface-container-low/40">
          <h2 className="text-headline-sm text-on-surface">Detalhamento dos 15 Indicadores</h2>
          <p className="text-body-sm text-on-surface-variant">C1-C7 (ESF/eAP), B1-B6 (eSB) e M1-M2 (eMulti) — resultado municipal do período.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-outline-variant/40 text-on-surface-variant text-label-md uppercase tracking-wider">
                <th className="py-3 px-4 md:px-5">Indicador</th>
                <th className="py-3 px-3 text-center">Meta</th>
                <th className="py-3 px-3 text-center">Resultado</th>
                <th className="py-3 px-4 min-w-[140px]">Progresso</th>
                <th className="py-3 px-3 text-right">Evolução</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-body-md">
              {avaliacao.indicadores.map((ind) => {
                const cor = ind.resultado?.classificacao ? CLASSIFICACAO[ind.resultado.classificacao] : null;
                const sufixo = ind.unidadeMedida === "percentual" ? "%" : "";
                const delta =
                  ind.resultado && ind.resultadoAnterior ? Math.round((ind.resultado.valorCalculado - ind.resultadoAnterior.valorCalculado) * 10) / 10 : null;
                return (
                  <tr key={ind.id} className={`hover:bg-surface-container-low/30 transition-colors ${cor?.rotulo === "Regular" ? "bg-error-container/10" : ""}`}>
                    <td className="py-3.5 px-4 md:px-5">
                      <div className="font-semibold text-on-surface text-label-lg flex items-center gap-2">
                        <span className="text-primary">{ind.codigo}</span> {ind.nome}
                      </div>
                      <div className="text-body-sm text-on-surface-variant">{ROTULO_EIXO[ind.alvo]}</div>
                    </td>
                    <td className="py-3.5 px-3 text-center text-on-surface-variant font-medium">
                      {ind.parametroBomMin !== null ? `${ind.parametroBomMin}${sufixo}` : "—"}
                    </td>
                    <td className={`py-3.5 px-3 text-center font-bold ${cor?.texto ?? "text-on-surface-variant"}`}>
                      {ind.resultado ? `${ind.resultado.valorCalculado}${sufixo}` : "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      {ind.resultado ? (
                        <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden">
                          <div className={`h-2.5 rounded-full ${cor?.barra ?? "bg-primary-container"}`} style={{ width: `${Math.min(100, Math.max(0, ind.resultado.valorCalculado))}%` }} />
                        </div>
                      ) : (
                        <span className="text-label-sm text-on-surface-variant">Sem apuração</span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      {delta !== null ? (
                        <span className={`font-bold text-label-lg ${delta >= 0 ? "text-secondary" : "text-error"}`}>
                          {delta >= 0 ? "+" : ""}
                          {delta} pp
                        </span>
                      ) : (
                        <span className="text-label-sm text-on-surface-variant">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {cor ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-label-sm font-bold ${cor.fundo} ${cor.texto}`}>
                          <Icon name={cor.rotulo === "Regular" ? "warning" : "check_circle"} className="text-body-md" />
                          {cor.rotulo}
                        </span>
                      ) : (
                        <span className="text-label-sm text-on-surface-variant">Sem apuração</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-surface-container-low/30 border-t border-outline-variant/30 flex flex-col sm:flex-row justify-between items-center text-label-sm text-on-surface-variant gap-2">
          <span>Fonte: motor de cálculo local a partir da base do e-SUS AB PEC sincronizada.</span>
          <Link href="/cadastros?status=com_erro" className="text-primary font-semibold hover:underline flex items-center gap-1">
            Ver inconsistências pendentes
            <Icon name="arrow_forward" className="text-body-md" />
          </Link>
        </div>
      </div>

      {/* Relatório da avaliação */}
      <div className="bg-surface-container-low/60 border border-outline-variant/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon name="fact_check" className="text-primary text-headline-md" />
          <div>
            <h4 className="text-headline-sm text-on-surface">Relatório da Avaliação</h4>
            <p className="text-body-sm text-on-surface-variant">
              {relatorioExistente
                ? `Gerado em ${formatarDataHora(relatorioExistente.geradoEm)}.`
                : "Nenhum relatório gerado ainda para este quadrimestre."}
            </p>
          </div>
        </div>
        {relatorioExistente?.arquivoUrl ? (
          <div className="flex items-center gap-2">
            <a href={relatorioExistente.arquivoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-outline-variant/60 hover:bg-surface-container-low text-on-surface text-label-md transition-colors">
              <Icon name="visibility" className="text-body-lg" />
              Visualizar
            </a>
            {podeDispararSincronizacao(usuario) && <GerarAvaliacaoBotao quadrimestre={periodo.quadrimestre} ano={periodo.ano} />}
          </div>
        ) : podeDispararSincronizacao(usuario) ? (
          <GerarAvaliacaoBotao quadrimestre={periodo.quadrimestre} ano={periodo.ano} />
        ) : (
          <span className="text-label-sm text-on-surface-variant">Apenas gestor local, secretário e coordenador podem gerar.</span>
        )}
      </div>
    </div>
  );
}
