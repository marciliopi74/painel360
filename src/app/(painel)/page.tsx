import Link from "next/link";
import type { Quadrimestre, TipoEquipe } from "@prisma/client";
import { auth } from "@/lib/auth";
import { obterResumoGeral, obterResumoPorTipoEquipe } from "@/lib/data/dashboard";
import { quadrimestreAtual, intervaloQuadrimestre, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import { Icon } from "@/components/Icon";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import { ICONE_TIPO, NOME_TIPO_COMPLETO as NOME_TIPO } from "@/lib/ui/tipoEquipe";
import { SeletorPeriodo } from "./SeletorPeriodo";

const CHIPS_TIPO: { valor: TipoEquipe | "todas"; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  { valor: "ESF", rotulo: "ESF" },
  { valor: "EAP", rotulo: "eAP" },
  { valor: "EMULTI", rotulo: "eMULTI" },
  { valor: "ESB", rotulo: "eSB" },
];

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; periodo?: string }>;
}) {
  const { tipo, periodo: periodoParam } = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const [periodoAno, periodoQuad] = periodoParam?.split("-") ?? [];
  const periodo =
    periodoQuad && (periodoQuad === "Q1" || periodoQuad === "Q2" || periodoQuad === "Q3")
      ? { quadrimestre: periodoQuad as Quadrimestre, ano: Number(periodoAno) }
      : quadrimestreAtual();

  const tipoSelecionado =
    tipo === "ESF" || tipo === "EAP" || tipo === "EMULTI" || tipo === "ESB" ? tipo : null;

  const [resumoGeral, resumoPorTipo, periodosDisponiveis] = await Promise.all([
    obterResumoGeral(usuario, periodo),
    obterResumoPorTipoEquipe(usuario, periodo, tipoSelecionado ? [tipoSelecionado] : undefined),
    listarPeriodosDisponiveis(),
  ]);

  const { fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);
  const diasParaFechamento = Math.ceil((fim.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de filtros e período */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-surface-container-lowest p-3.5 rounded-lg border border-outline-variant/40 shadow-sm">
        <div className="flex items-center flex-wrap gap-1.5">
          <span className="text-label-sm text-on-surface-variant mr-1.5 font-bold uppercase">Equipes:</span>
          {CHIPS_TIPO.map((chip) => {
            const ativo = chip.valor === "todas" ? !tipoSelecionado : tipoSelecionado === chip.valor;
            const href = chip.valor === "todas" ? "?" : `?tipo=${chip.valor}`;
            return (
              <Link
                key={chip.valor}
                href={href}
                className={`px-3 py-1 rounded-full text-label-sm transition-all ${
                  ativo
                    ? "bg-primary text-on-primary font-bold shadow-sm"
                    : "bg-surface-container text-on-surface hover:bg-surface-variant"
                }`}
              >
                {chip.rotulo}
              </Link>
            );
          })}
        </div>
        <SeletorPeriodo
          selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
          periodos={periodosDisponiveis.map((p) => ({
            valor: `${p.ano}-${p.quadrimestre}`,
            rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano),
          }))}
        />
      </section>

      {/* Banner de média de indicadores */}
      <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Icon name="workspace_premium" className="text-primary" />
          <span className="text-label-md uppercase tracking-wider text-primary font-bold">
            Média dos indicadores de qualidade
          </span>
        </div>
        {resumoGeral.mediaIndicadoresPercentuais === null ? (
          <p className="text-body-md text-on-surface-variant mt-1">
            Nenhum indicador percentual apurado ainda para {rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}.
          </p>
        ) : (
          <>
            <h2 className="text-headline-lg text-on-surface font-bold tracking-tight">
              {resumoGeral.mediaIndicadoresPercentuais.toLocaleString("pt-BR")}% de média nos indicadores calculados
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Cálculo interno — média simples dos indicadores percentuais já apurados; não é o Indicador Sintético
              Final (ISF) oficial do SISAB, que usa pesos por indicador não documentados neste projeto.
            </p>
            <div className="w-full md:w-96 mt-3">
              <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, resumoGeral.mediaIndicadoresPercentuais))}%` }}
                />
              </div>
            </div>
          </>
        )}
      </section>

      {/* Cartões-resumo */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5 shadow-sm hover:border-primary-container/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-md text-on-surface-variant">Cadastros Individuais</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <Icon name="how_to_reg" className="text-body-lg" />
              </div>
            </div>
            <div className="text-headline-lg font-bold text-on-surface">
              {formatarNumero(resumoGeral.cadastrosIndividuaisTotal)}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm bg-secondary-container/40 text-secondary font-bold">
                +{formatarNumero(resumoGeral.cadastrosIndividuaisNovosNoMes)} no mês
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5 shadow-sm hover:border-primary-container/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-md text-on-surface-variant">Cadastros Domiciliares</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <Icon name="home_health" className="text-body-lg" />
              </div>
            </div>
            <div className="text-headline-lg font-bold text-on-surface">
              {formatarNumero(resumoGeral.cadastrosDomiciliaresTotal)}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm bg-secondary-container/40 text-secondary font-bold">
                +{formatarNumero(resumoGeral.cadastrosDomiciliaresNovosNoMes)} no mês
              </span>
            </div>
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-4 sm:p-5 shadow-sm hover:border-primary-container/40 transition-colors flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-md text-on-surface-variant">Atendimentos no Período</span>
              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                <Icon name="clinical_notes" className="text-body-lg" />
              </div>
            </div>
            <div className="text-headline-lg font-bold text-on-surface">
              {formatarNumero(resumoGeral.atendimentosPeriodo)}
            </div>
            <div className="text-body-sm text-on-surface-variant mt-2">
              Consultas e atendimentos registrados em {rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}.
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between">
            <span className="text-label-sm text-on-surface-variant">Média diária</span>
            <span className="text-label-sm font-bold text-primary">
              {resumoGeral.mediaDiariaAtendimentos.toLocaleString("pt-BR")} atendimentos/dia
            </span>
          </div>
        </div>

        <Link
          href="/cadastros"
          className={`rounded-lg p-4 sm:p-5 shadow-sm transition-colors flex flex-col justify-between bg-surface-container-lowest border ${
            resumoGeral.inconsistencias > 0 ? "border-error/30 hover:border-error" : "border-outline-variant/40"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-label-md font-semibold ${
                  resumoGeral.inconsistencias > 0 ? "text-error" : "text-on-surface-variant"
                }`}
              >
                Inconsistências &amp; Alertas
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  resumoGeral.inconsistencias > 0
                    ? "bg-error-container text-error"
                    : "bg-surface-container text-primary"
                }`}
              >
                <Icon name="warning" className="text-body-lg" />
              </div>
            </div>
            <div className={`text-headline-lg font-bold ${resumoGeral.inconsistencias > 0 ? "text-error" : "text-on-surface"}`}>
              {formatarNumero(resumoGeral.inconsistencias)}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {resumoGeral.inconsistencias > 0 ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm bg-error-container text-error font-bold">
                  Atenção imediata
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-label-sm bg-secondary-container/40 text-secondary font-bold">
                  Nenhuma pendência
                </span>
              )}
            </div>
          </div>
          {resumoGeral.principaisTiposErro.length > 0 && (
            <div className="mt-4 pt-3 border-t border-surface-container flex items-center justify-between gap-2">
              <span className="text-label-sm text-on-surface-variant truncate">
                {resumoGeral.principaisTiposErro.join(" / ")}
              </span>
              <span className="text-label-sm font-bold text-error shrink-0">Resolver</span>
            </div>
          )}
        </Link>
      </section>

      {/* Desempenho por tipo de equipe */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-headline-sm font-bold text-on-surface">Desempenho por Tipo de Equipe</h3>
            <p className="text-body-sm text-on-surface-variant">
              Acompanhamento operacional por modalidade de atenção básica municipal
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {resumoPorTipo.map((r) => {
            const classificacao = r.classificacaoPredominante ? CLASSIFICACAO[r.classificacaoPredominante] : null;
            return (
              <div
                key={r.tipo}
                className="bg-surface-container-lowest border border-outline-variant/40 rounded-lg p-5 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded bg-surface-container text-primary text-label-sm font-bold tracking-wider uppercase">
                      {r.tipo}
                    </span>
                    {classificacao && (
                      <span className={`inline-flex items-center gap-1 text-label-sm font-bold ${classificacao.texto}`}>
                        <span className={`w-2 h-2 rounded-full ${classificacao.ponto}`} />
                        {classificacao.rotulo}
                      </span>
                    )}
                  </div>
                  <h4 className="text-headline-sm font-bold text-on-surface mt-2.5">{NOME_TIPO[r.tipo]}</h4>
                  <div className="flex items-center gap-2 mt-1 text-body-sm text-on-surface-variant">
                    <Icon name={ICONE_TIPO[r.tipo]} className="text-body-md" />
                    <span>
                      {r.equipesAtivas} {r.equipesAtivas === 1 ? "equipe ativa" : "equipes ativas"} no município
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-label-sm text-on-surface-variant">Média de indicadores</span>
                      <span className={`text-headline-sm font-bold ${classificacao?.texto ?? "text-on-surface-variant"}`}>
                        {r.percentualMetaAtingida === null ? "—" : `${r.percentualMetaAtingida}%`}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${classificacao?.barra ?? "bg-outline-variant"}`}
                        style={{ width: `${Math.min(100, Math.max(0, r.percentualMetaAtingida ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-surface-container text-label-sm text-on-surface-variant flex justify-between">
                  <span>
                    Cadastros individuais: <strong>{formatarNumero(r.cadastrosIndividuais)}</strong>
                  </span>
                  <span>
                    Atendimentos: <strong>{formatarNumero(r.atendimentos)}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Próximos passos */}
      <section className="bg-surface-container-low border border-outline-variant/40 rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary-container text-on-primary-container mt-0.5">
            <Icon name="assignment_late" />
          </div>
          <div>
            <h4 className="text-label-lg font-bold text-on-surface">Próximos passos para o fechamento do período</h4>
            <p className="text-body-sm text-on-surface-variant">
              {resumoGeral.inconsistencias > 0
                ? `Verifique a sincronização de ${formatarNumero(resumoGeral.inconsistencias)} registros com inconsistência`
                : "Nenhuma inconsistência pendente"}
              {diasParaFechamento >= 0
                ? ` antes do fechamento do quadrimestre em ${diasParaFechamento} dia${diasParaFechamento === 1 ? "" : "s"}.`
                : " — quadrimestre já encerrado."}
            </p>
          </div>
        </div>
        <Link
          href="/relatorios"
          className="whitespace-nowrap px-4 py-2 bg-surface-container-lowest border border-primary text-primary hover:bg-surface-variant text-label-md font-semibold rounded-lg transition-colors"
        >
          Ver relatórios
        </Link>
      </section>
    </div>
  );
}
