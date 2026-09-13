import type { Quadrimestre, TipoEquipe } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { obterResumoAtendimentos, listarDesempenhoPorEquipe } from "@/lib/data/atendimentos";
import { listarEquipesVisiveis } from "@/lib/data/equipes";
import { quadrimestreAtual, intervaloQuadrimestre, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import type { StatusCadastro } from "@/lib/data/cadastros";
import { CODIGOS_LISTA_NOMINAL, listarListaNominal, type CodigoListaNominal } from "@/lib/data/listaNominal";
import { FiltrosAtendimentos } from "./FiltrosAtendimentos";
import { DesempenhoEquipeCard } from "./DesempenhoEquipeCard";
import { OrdenarSelect } from "./OrdenarSelect";
import { ListaNominalIndicador } from "./ListaNominalIndicador";
import { NOME_TIPO_CURTO as NOME_TIPO } from "@/lib/ui/tipoEquipe";

const ORDENACOES = [
  { valor: "erros", rotulo: "Maior taxa de inconsistência" },
  { valor: "volume", rotulo: "Maior volume de atendimentos" },
  { valor: "meta_baixa", rotulo: "Menor meta atingida" },
] as const;

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default async function AtendimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; equipe?: string; status?: string; periodo?: string; ordenar?: string; lista?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const [anoParam, quadParam] = (params.periodo ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam)
      ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) }
      : quadrimestreAtual();

  const tipoEquipe = params.tipo && ["ESF", "EAP", "EMULTI", "ESB"].includes(params.tipo) ? (params.tipo as TipoEquipe) : undefined;
  const status = params.status && ["com_erro", "sem_erro"].includes(params.status) ? (params.status as StatusCadastro) : undefined;
  const ordenar = ORDENACOES.some((o) => o.valor === params.ordenar) ? params.ordenar! : "erros";
  const listaSelecionada = (CODIGOS_LISTA_NOMINAL as readonly string[]).includes(params.lista ?? "") ? (params.lista as CodigoListaNominal) : null;

  const filtros = { tipoEquipe, equipeId: params.equipe || undefined, status, ...periodo };

  const [resumo, desempenho, opcoesEquipe, periodosDisponiveis, listaNominal] = await Promise.all([
    obterResumoAtendimentos(usuario, filtros),
    listarDesempenhoPorEquipe(usuario, filtros),
    listarEquipesVisiveis(usuario),
    listarPeriodosDisponiveis(),
    listaSelecionada ? listarListaNominal(usuario, listaSelecionada, periodo.quadrimestre, periodo.ano) : Promise.resolve(null),
  ]);

  const desempenhoOrdenado = [...desempenho].sort((a, b) => {
    if (ordenar === "volume") return b.atendimentos - a.atendimentos;
    if (ordenar === "meta_baixa") return (a.percentualMeta ?? 0) - (b.percentualMeta ?? 0);
    return b.comErro - a.comErro || b.atendimentos - a.atendimentos;
  });

  const { fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);
  const diasParaFechamento = Math.ceil((fim.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const paramsExport = new URLSearchParams();
  paramsExport.set("periodo", `${periodo.ano}-${periodo.quadrimestre}`);
  if (tipoEquipe) paramsExport.set("tipo", tipoEquipe);
  if (params.equipe) paramsExport.set("equipe", params.equipe);
  if (status) paramsExport.set("status", status);

  const taxaErro = resumo.total === 0 ? 0 : Math.round((resumo.comErro / resumo.total) * 1000) / 10;

  function hrefLista(codigo: CodigoListaNominal | null) {
    const p = new URLSearchParams();
    p.set("periodo", `${periodo.ano}-${periodo.quadrimestre}`);
    if (tipoEquipe) p.set("tipo", tipoEquipe);
    if (params.equipe) p.set("equipe", params.equipe);
    if (status) p.set("status", status);
    if (codigo) p.set("lista", codigo);
    return `?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-label-sm">
              {rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}
            </span>
          </div>
          <h1 className="text-headline-lg text-on-surface tracking-tight">Atendimentos Clínicos</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Produção clínica e consistência dos registros sincronizados do e-SUS.
          </p>
        </div>
        <a
          href={`/api/atendimentos/exportar?${paramsExport.toString()}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container text-on-surface-variant text-label-md transition whitespace-nowrap self-start"
        >
          <Icon name="file_download" className="text-body-md" />
          Exportar CSV
        </a>
      </div>

      <FiltrosAtendimentos
        tipoEquipeSelecionado={tipoEquipe ?? ""}
        equipeSelecionada={params.equipe ?? ""}
        statusSelecionado={status ?? ""}
        periodoSelecionado={`${periodo.ano}-${periodo.quadrimestre}`}
        opcoesEquipe={opcoesEquipe}
        opcoesPeriodo={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
      />

      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Produção consolidada */}
        <div className="lg:col-span-8 bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <Icon name="clinical_notes" className="text-body-lg" />
                </span>
                <div>
                  <h2 className="text-headline-sm text-on-surface">Produção Clínica Consolidada</h2>
                  <p className="text-label-sm text-on-surface-variant">Atendimentos da atenção primária no período</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-surface-container-low text-primary text-label-sm border border-primary/20">
                Meta de referência: {formatarNumero(resumo.meta)}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-4 my-3">
              <span className="text-4xl font-bold tracking-tight text-on-surface">{formatarNumero(resumo.total)}</span>
              <span className="text-body-md text-on-surface-variant">atendimentos realizados no período</span>
              {resumo.percentualMeta !== null && (
                <span
                  className={`sm:ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-label-sm font-semibold ${
                    resumo.percentualMeta >= 100 ? "bg-[#EAF8F1] text-[#1E824C]" : "bg-surface-container text-primary"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${resumo.percentualMeta >= 100 ? "bg-[#2FBF71]" : "bg-primary"}`} />
                  {resumo.percentualMeta}% da meta atingida
                </span>
              )}
            </div>
            <div className="mt-4 mb-2">
              <div className="flex justify-between text-label-sm text-on-surface-variant mb-1.5">
                <span>Progresso Atual ({formatarNumero(resumo.total)})</span>
                <span className="font-semibold text-primary">{resumo.percentualMeta ?? "—"}%</span>
                <span>Alvo: {formatarNumero(resumo.meta)}</span>
              </div>
              <div className="relative w-full h-3 bg-surface-variant rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-container rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, resumo.percentualMeta ?? 0))}%` }}
                />
              </div>
              <p className="text-label-sm text-on-surface-variant mt-1.5">
                Meta operacional de referência ({formatarNumero(resumo.meta)} = valor configurável por profissional ativo × 4 meses do
                quadrimestre) — ainda não existe uma tela de metas pactuadas dedicada.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 mt-4 border-t border-outline-variant/30 text-center sm:text-left">
            {(Object.keys(NOME_TIPO) as TipoEquipe[]).map((tipo) => (
              <div key={tipo} className="p-2.5 rounded-lg bg-surface-container-low/50">
                <span className="text-label-sm text-on-surface-variant block">{NOME_TIPO[tipo]}</span>
                <span className="text-headline-sm font-bold text-on-surface">{formatarNumero(resumo.porTipoEquipe[tipo])}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Auditoria e-SUS */}
        <div className="lg:col-span-4 bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-sm font-bold uppercase tracking-wider text-outline">Auditoria e-SUS</span>
              {resumo.comErro > 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#FEF6EE] text-[#B25E16] text-label-sm font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F4A261]" />
                  Atenção
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#EAF8F1] text-[#1E824C] text-label-sm font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF71]" />
                  Conforme
                </span>
              )}
            </div>
            <h3 className="text-headline-sm text-on-surface">Inconsistências nos Atendimentos</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Fichas que correm risco de glosa ou anulação nos indicadores do Previne Brasil.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-[#FDF0ED] border border-[#E5533C]/20">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-[#B8321D]">{taxaErro}%</span>
                <span className="text-label-md text-on-surface-variant">taxa de erro</span>
              </div>
              <p className="text-body-sm text-[#B8321D] font-medium mt-1">
                {formatarNumero(resumo.comErro)} {resumo.comErro === 1 ? "atendimento" : "atendimentos"} com pendência
              </p>
            </div>
            {resumo.principaisTiposErro.length > 0 && (
              <div className="mt-4 space-y-2 text-label-sm">
                {resumo.principaisTiposErro.map((erro) => (
                  <div key={erro.tipoErro} className="flex items-center justify-between py-1 border-b border-outline-variant/20">
                    <span className="text-on-surface-variant">{erro.rotulo}</span>
                    <span className="font-bold text-on-surface">{formatarNumero(erro.contagem)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {resumo.comErro > 0 && (
            <a
              href="?status=com_erro"
              className="mt-4 w-full py-2.5 px-3 rounded-lg bg-surface-container-high hover:bg-surface-container text-primary text-label-md flex items-center justify-center gap-2 transition-colors"
            >
              <Icon name="search_check" className="text-body-md" />
              Ver equipes com pendência
            </a>
          )}
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
        <div>
          <h2 className="text-headline-sm text-on-surface">Desempenho por Equipe</h2>
          <p className="text-body-sm text-on-surface-variant">Produção e conformidade dos registros por equipe no período.</p>
        </div>
        <OrdenarSelect selecionado={ordenar} opcoes={ORDENACOES} />
      </div>

      {desempenhoOrdenado.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
          Nenhuma equipe com atendimentos ou profissionais ativos para esse filtro.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {desempenhoOrdenado.map((eq) => (
            <DesempenhoEquipeCard key={eq.equipeId} equipe={eq} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2">
        <div>
          <h2 className="text-headline-sm text-on-surface">Lista Nominal por Indicador</h2>
          <p className="text-body-sm text-on-surface-variant">
            Pacientes elegíveis em cada indicador no período, com as boas práticas já atingidas e as pendentes até o último atendimento.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {CODIGOS_LISTA_NOMINAL.map((codigo) => (
            <a
              key={codigo}
              href={hrefLista(listaSelecionada === codigo ? null : codigo)}
              className={`px-3.5 py-1.5 rounded-lg text-label-md font-bold border transition-colors ${
                listaSelecionada === codigo
                  ? "bg-primary text-on-primary border-primary"
                  : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:bg-surface-container"
              }`}
            >
              {codigo}
            </a>
          ))}
        </div>
        {listaSelecionada && listaNominal && <ListaNominalIndicador dados={listaNominal} />}
      </div>

      <div className="rounded-xl p-4 bg-surface-container border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
            <Icon name="notification_important" />
          </div>
          <div>
            <h4 className="text-headline-sm text-on-surface">Fechamento do Quadrimestre</h4>
            <p className="text-body-sm text-on-surface-variant">
              {diasParaFechamento >= 0
                ? `Faltam ${diasParaFechamento} dia${diasParaFechamento === 1 ? "" : "s"} para o fim de ${rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}. Corrija as pendências antes do fechamento.`
                : "Este quadrimestre já foi encerrado."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
