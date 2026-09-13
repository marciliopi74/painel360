import { notFound } from "next/navigation";
import type { Quadrimestre } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { DetalheMetodologico } from "@/components/indicadores/DetalheMetodologico";
import {
  obterEquipe,
  listarEquipesParaSeletor,
  listarIndicadoresEquipe,
  obterProducaoEquipe,
  listarProfissionaisDetalhados,
} from "@/lib/data/equipeDetalhe";
import { quadrimestreAtual, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import { NOME_TIPO_COMPLETO, ICONE_TIPO } from "@/lib/ui/tipoEquipe";
import { SeletorPeriodo } from "../../SeletorPeriodo";
import { SeletorEquipe } from "../SeletorEquipe";

const ABA_POR_TIPO: Record<string, string> = { ESF: "ESF_EAP", EAP: "ESF_EAP", EMULTI: "EMULTI", ESB: "ESB" };

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default async function DetalheEquipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { id } = await params;
  const { periodo: periodoParam } = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const equipe = await obterEquipe(usuario, id);
  if (!equipe) notFound();

  const [anoParam, quadParam] = (periodoParam ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();

  const [opcoesEquipe, indicadores, producao, profissionais, periodosDisponiveis] = await Promise.all([
    listarEquipesParaSeletor(usuario),
    listarIndicadoresEquipe(equipe.tipo, equipe.id, periodo.quadrimestre, periodo.ano),
    obterProducaoEquipe(equipe.id, periodo.quadrimestre, periodo.ano),
    listarProfissionaisDetalhados(equipe.id),
    listarPeriodosDisponiveis(),
  ]);

  const comResultado = indicadores.filter((i) => i.resultado);
  const mediaIndicadores =
    comResultado.length > 0 ? Math.round((comResultado.reduce((s, i) => s + (i.resultado?.valorCalculado ?? 0), 0) / comResultado.length) * 10) / 10 : null;

  const contagemClassificacao = new Map<string, number>();
  for (const i of comResultado) contagemClassificacao.set(i.resultado!.classificacao, (contagemClassificacao.get(i.resultado!.classificacao) ?? 0) + 1);
  const classificacaoPredominante =
    [...contagemClassificacao.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const corClassificacao = classificacaoPredominante ? CLASSIFICACAO[classificacaoPredominante as keyof typeof CLASSIFICACAO] : null;

  const profissionaisAtivos = profissionais.filter((p) => p.ativo);

  return (
    <div className="flex flex-col gap-6">
      {/* Seletor e cabeçalho contextual */}
      <section className="bg-surface-container-lowest rounded-xl p-4 sm:p-6 shadow-sm border border-outline-variant/30 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant">Detalhamento da Equipe</span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-medium ${
                equipe.ativo ? "bg-surface-container text-primary" : "bg-error-container text-on-error-container"
              }`}
            >
              <Icon name={equipe.ativo ? "verified" : "block"} className="text-[14px]" />
              {equipe.ativo ? "Ativa" : "Inativa"}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SeletorEquipe equipeId={equipe.id} opcoes={opcoesEquipe} />
            <div className="hidden sm:block h-6 w-px bg-outline-variant/40" />
            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-body-sm text-on-surface-variant">
              <span className="inline-flex items-center gap-1">
                <Icon name={ICONE_TIPO[equipe.tipo]} className="text-[16px] text-primary" />
                {NOME_TIPO_COMPLETO[equipe.tipo]}
              </span>
              {equipe.ine && (
                <>
                  <span>•</span>
                  <span>
                    <strong>INE:</strong> {equipe.ine}
                  </span>
                </>
              )}
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-primary font-medium">
                <Icon name="group" className="text-[16px]" />
                {equipe._count.profissionais} {equipe._count.profissionais === 1 ? "profissional vinculado" : "profissionais vinculados"}
              </span>
            </div>
          </div>
        </div>
        <SeletorPeriodo
          selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
          periodos={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
        />
      </section>

      {/* Bento: score, produção, conformidade */}
      <section className="grid grid-cols-1 md:grid-cols-12 gap-5">
        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-label-md font-semibold text-on-surface-variant uppercase tracking-wider">Média dos Indicadores</span>
              {corClassificacao && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-sm font-semibold ${corClassificacao.fundo} ${corClassificacao.texto}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${corClassificacao.ponto}`} />
                  {corClassificacao.rotulo}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[44px] leading-tight font-extrabold text-primary">{mediaIndicadores ?? "—"}</span>
              {mediaIndicadores !== null && <span className="text-headline-sm text-on-surface-variant">%</span>}
            </div>
            <p className="text-body-sm text-on-surface-variant">
              {mediaIndicadores === null
                ? `Nenhum indicador apurado para ${rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)} ainda.`
                : `Média simples dos ${comResultado.length} indicadores já apurados em ${rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}.`}
            </p>
          </div>
          {mediaIndicadores !== null && (
            <div className="mt-6 pt-4 border-t border-outline-variant/20">
              <div className="w-full h-3 bg-surface-variant rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${corClassificacao?.barra ?? "bg-primary-container"}`} style={{ width: `${Math.min(100, Math.max(0, mediaIndicadores))}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-label-md font-semibold text-on-surface-variant uppercase tracking-wider">Produção do Período</span>
            <div className="flex items-baseline gap-2 mt-2 mb-1">
              <span className="text-[36px] font-bold text-on-surface">{formatarNumero(producao.atendimentos)}</span>
              <span className="text-body-sm text-on-surface-variant">atendimentos</span>
            </div>
            <div className="mt-4 space-y-2 text-body-sm">
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Cadastros individuais</span>
                <span className="font-semibold text-on-surface">{formatarNumero(producao.cadastrosIndividuais)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">Cadastros domiciliares</span>
                <span className="font-semibold text-on-surface">{formatarNumero(producao.cadastrosDomiciliares)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-label-sm text-on-surface-variant">
            <a href={`/atendimentos?equipe=${equipe.id}`} className="text-primary hover:underline font-semibold flex items-center gap-0.5">
              Ver em Atendimentos <Icon name="arrow_forward" className="text-[14px]" />
            </a>
          </div>
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/30 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-label-md font-semibold text-on-surface-variant uppercase tracking-wider">Conformidade e-SUS</span>
            <div className="flex items-baseline gap-2 mt-2 mb-1">
              <span className={`text-[36px] font-bold ${producao.comErro > 0 ? "text-error" : "text-on-surface"}`}>{formatarNumero(producao.comErro)}</span>
              <span className="text-body-sm text-on-surface-variant">com pendência</span>
            </div>
            <p className="text-body-sm text-on-surface-variant">
              {producao.comErro > 0 ? "Registros com inconsistência detectada no período." : "Nenhuma inconsistência detectada no período."}
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-label-sm text-on-surface-variant">
            <a href={`/cadastros?equipe=${equipe.id}${producao.comErro > 0 ? "&status=com_erro" : ""}`} className="text-primary hover:underline font-semibold flex items-center gap-0.5">
              Ver em Cadastros <Icon name="arrow_forward" className="text-[14px]" />
            </a>
          </div>
        </div>
      </section>

      {/* Indicadores chave */}
      <section className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/30 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-4">
          <div>
            <h2 className="text-headline-md text-on-surface font-bold">Indicadores de Qualidade da Equipe</h2>
            <p className="text-body-sm text-on-surface-variant">Resultados oficiais apurados pelo motor de cálculo (Previne Brasil).</p>
          </div>
          <span className="text-label-sm text-on-surface-variant">
            Competência: <strong>{rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}</strong>
          </span>
        </div>
        {indicadores.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">Nenhum indicador cadastrado para este tipo de equipe.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {indicadores.map((ind) => {
              const cor = ind.resultado ? CLASSIFICACAO[ind.resultado.classificacao] : null;
              const podeDetalhar = ind.categoria === "boa_pratica_pontuada" && ind.resultado;
              const conteudo = (
                <div className="p-4 rounded-xl border border-outline-variant/30 bg-surface hover:bg-surface-container-low transition-colors duration-150 flex flex-col justify-between space-y-3 h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-label-sm font-bold text-primary uppercase tracking-wide">{ind.codigo}</span>
                      <h3 className="text-body-md font-semibold text-on-surface">{ind.nome}</h3>
                    </div>
                    {cor && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-semibold shrink-0 ${cor.fundo} ${cor.texto}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cor.ponto}`} />
                        {cor.rotulo}
                      </span>
                    )}
                  </div>
                  {ind.resultado ? (
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <span className={`text-headline-lg font-extrabold ${cor?.texto ?? "text-on-surface"}`}>{ind.resultado.valorCalculado}%</span>
                        {ind.parametroBomMin !== null && <span className="text-label-md text-on-surface-variant">Meta: {ind.parametroBomMin}%</span>}
                      </div>
                      <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${cor?.barra ?? "bg-primary-container"}`} style={{ width: `${Math.min(100, Math.max(0, ind.resultado.valorCalculado))}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-label-sm text-on-surface-variant mt-2">
                        <span>
                          {formatarNumero(ind.resultado.numerador)} de {formatarNumero(ind.resultado.denominador)}
                        </span>
                        {podeDetalhar && <span className="text-primary font-medium">Ver por pessoa →</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-label-sm text-on-surface-variant">Ainda não apurado neste período.</p>
                  )}
                  <DetalheMetodologico
                    formulaNumerador={ind.formulaNumerador}
                    formulaDenominador={ind.formulaDenominador}
                    bandas={ind.bandas}
                    unidadeMedida={ind.unidadeMedida}
                    classificacaoAtual={ind.resultado?.classificacao ?? null}
                    valorAtual={ind.resultado?.valorCalculado ?? null}
                  />
                </div>
              );
              return podeDetalhar ? (
                <a
                  key={ind.id}
                  href={`/indicadores-qualidade?aba=${ABA_POR_TIPO[equipe.tipo]}&equipe=${equipe.id}&indicador=${ind.id}`}
                  className="block h-full"
                >
                  {conteudo}
                </a>
              ) : (
                <div key={ind.id}>{conteudo}</div>
              );
            })}
          </div>
        )}
      </section>

      {/* Profissionais da equipe */}
      <section className="bg-surface-container-lowest rounded-xl p-5 sm:p-6 border border-outline-variant/30 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/20 pb-3">
          <div>
            <h2 className="text-headline-md text-on-surface font-bold">Profissionais da Equipe</h2>
            <p className="text-body-sm text-on-surface-variant">Vínculo ativo e cadastros/visitas registrados por cada profissional.</p>
          </div>
          <span className="text-label-sm text-on-surface-variant">{profissionaisAtivos.length} ativos de {profissionais.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-surface border-b border-outline-variant/30 text-on-surface-variant text-label-sm uppercase">
                <th className="py-3 px-4">Profissional</th>
                <th className="py-3 px-3">Função</th>
                <th className="py-3 px-3">Cadastros individuais</th>
                <th className="py-3 px-3">Visitas domiciliares</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-body-sm">
              {profissionais.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 px-4 text-center text-on-surface-variant">
                    Nenhum profissional sincronizado para esta equipe.
                  </td>
                </tr>
              )}
              {profissionais.map((p) => (
                <tr key={p.id} className="hover:bg-surface-container-low transition-colors duration-100">
                  <td className="py-3.5 px-4 font-semibold text-on-surface">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-label-md shrink-0">
                        {iniciais(p.nome)}
                      </div>
                      <div>
                        <div className="font-bold text-on-surface">{p.nome}</div>
                        <div className="text-[11px] text-on-surface-variant">CBO {p.cbo}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-on-surface">
                    {p.ehAcs ? "Agente Comunitário de Saúde" : "Equipe clínica/administrativa"}
                  </td>
                  <td className="py-3.5 px-3 font-semibold text-on-surface">{formatarNumero(p.cadastrosIndividuaisRegistrados)}</td>
                  <td className="py-3.5 px-3 font-semibold text-on-surface">{formatarNumero(p.visitasDomiciliaresRegistradas)}</td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-label-sm font-medium ${
                        p.ativo ? "bg-secondary-container/40 text-secondary" : "bg-surface-container text-on-surface-variant"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${p.ativo ? "bg-secondary" : "bg-outline"}`} />
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          Produção clínica individual (consultas por médico/enfermeiro) não é atribuível com confiança nos dados sincronizados do e-SUS —
          ver produção consolidada da equipe acima.
        </p>
      </section>
    </div>
  );
}
