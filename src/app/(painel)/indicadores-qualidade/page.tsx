import Link from "next/link";
import type { Quadrimestre, TipoEquipeAlvo } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { obterIndicadoresMunicipais } from "@/lib/data/indicadores";
import { listarListaNominalPorIndicador } from "@/lib/data/listaNominal";
import { quadrimestreAtual, intervaloQuadrimestre, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import { SeletorPeriodo } from "../SeletorPeriodo";
import { IndicadorCard } from "./IndicadorCard";

const ABAS: { chave: TipoEquipeAlvo; rotulo: string; icone: string }[] = [
  { chave: "ESF_EAP", rotulo: "ESF / eAP (C1-C7)", icone: "groups" },
  { chave: "ESB", rotulo: "Saúde Bucal - eSB (B1-B6)", icone: "dentistry" },
  { chave: "EMULTI", rotulo: "eMulti (M1-M2)", icone: "diversity_1" },
];

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default async function IndicadoresQualidadePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; periodo?: string; indicador?: string; equipe?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const aba = (ABAS.find((a) => a.chave === params.aba)?.chave ?? "ESF_EAP") as TipoEquipeAlvo;

  const [anoParam, quadParam] = (params.periodo ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();

  const [{ indicadores, equipeIds }, periodosDisponiveis] = await Promise.all([
    obterIndicadoresMunicipais(usuario, aba, periodo.quadrimestre, periodo.ano),
    listarPeriodosDisponiveis(),
  ]);

  const { inicio, fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);
  const [cadastrosIndividuais, erroIndividuais, erroDomiciliares, erroAtendimentos] = await Promise.all([
    prisma.cadastroIndividual.count({ where: { equipeId: { in: equipeIds } } }),
    prisma.cadastroIndividual.count({ where: { equipeId: { in: equipeIds }, temErro: true, dataCadastro: { gte: inicio, lte: fim } } }),
    prisma.cadastroDomiciliar.count({ where: { equipeId: { in: equipeIds }, temErro: true, dataCadastro: { gte: inicio, lte: fim } } }),
    prisma.atendimento.count({ where: { equipeId: { in: equipeIds }, temErro: true, dataAtendimento: { gte: inicio, lte: fim } } }),
  ]);
  const inconsistencias = erroIndividuais + erroDomiciliares + erroAtendimentos;

  const apurados = indicadores.filter((i) => i.resultado);
  const percentuais = apurados.filter((i) => i.unidadeMedida === "percentual");
  const mediaGeral = percentuais.length > 0 ? Math.round((percentuais.reduce((s, i) => s + (i.resultado?.valorCalculado ?? 0), 0) / percentuais.length) * 10) / 10 : null;
  const metasBatidas = apurados.filter((i) => i.resultado?.classificacao === "otimo" || i.resultado?.classificacao === "bom").length;

  const diasParaFechamento = Math.ceil((fim.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const indicadorExpandido = params.indicador ? indicadores.find((i) => i.id === params.indicador) : null;
  const equipeIdsListaNominal = params.equipe ? [params.equipe] : equipeIds;
  const listaNominal = indicadorExpandido
    ? await listarListaNominalPorIndicador(indicadorExpandido.codigo, indicadorExpandido.id, equipeIdsListaNominal, periodo.quadrimestre, periodo.ano)
    : null;

  function hrefAba(chave: TipoEquipeAlvo) {
    const p = new URLSearchParams();
    p.set("aba", chave);
    if (params.periodo) p.set("periodo", params.periodo);
    return `?${p.toString()}`;
  }

  function hrefIndicador(indicadorId: string | null) {
    const p = new URLSearchParams();
    p.set("aba", aba);
    if (params.periodo) p.set("periodo", params.periodo);
    if (indicadorId) p.set("indicador", indicadorId);
    if (indicadorId && params.equipe) p.set("equipe", params.equipe);
    return `?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-headline-lg text-on-surface">Desempenho Municipal da Atenção Primária</h1>
          </div>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Acompanhamento quadrimestral para apuração dos indicadores de qualidade do Previne Brasil.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <SeletorPeriodo
            selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
            periodos={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
          />
          <div className="inline-flex p-1 bg-surface-container-high rounded-xl self-start sm:self-auto border border-outline-variant/50 overflow-x-auto">
            {ABAS.map((a) => (
              <Link
                key={a.chave}
                href={hrefAba(a.chave)}
                className={`px-4 py-2 rounded-lg text-label-md whitespace-nowrap flex items-center gap-1.5 transition-all ${
                  a.chave === aba ? "font-bold bg-primary-container text-on-primary shadow-sm" : "font-medium text-on-surface-variant hover:text-on-surface"
                }`}
              >
                <Icon name={a.icone} className="text-body-sm" />
                {a.rotulo}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Banner resumo */}
      <section className="bg-surface-container-lowest rounded-xl p-5 md:p-6 border border-outline-variant/60 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-outline-variant/60 pb-4 lg:pb-0 lg:pr-6 flex flex-col justify-center">
            <span className="text-label-md text-on-surface-variant font-medium uppercase tracking-wider">Média dos Indicadores do Eixo</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-extrabold text-primary tracking-tight">{mediaGeral ?? "—"}</span>
              {mediaGeral !== null && <span className="text-lg text-on-surface-variant font-semibold">%</span>}
            </div>
            <p className="text-body-sm text-on-surface-variant mt-2">
              Cálculo interno — média simples dos indicadores percentuais já apurados; não é o Indicador Sintético Final (ISF) oficial do
              SISAB, que usa pesos por indicador não documentados neste projeto.
            </p>
          </div>
          <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Metas Batidas</span>
              <span className="text-headline-sm font-bold text-secondary">
                {apurados.length > 0 ? `${metasBatidas} / ${apurados.length}` : "—"}
              </span>
              <span className="text-label-sm text-secondary font-medium block mt-0.5">
                {apurados.length > 0 ? `${Math.round((metasBatidas / apurados.length) * 100)}% de êxito` : "Nenhum apurado"}
              </span>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Cadastros Individuais</span>
              <span className="text-headline-sm font-bold text-on-surface">{formatarNumero(cadastrosIndividuais)}</span>
              <span className="text-label-sm text-on-surface-variant block mt-0.5">
                {equipeIds.length} {equipeIds.length === 1 ? "equipe no eixo" : "equipes no eixo"}
              </span>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Alertas de Inconsistência</span>
              <span className={`text-headline-sm font-bold ${inconsistencias > 0 ? "text-tertiary" : "text-on-surface"}`}>
                {formatarNumero(inconsistencias)} {inconsistencias === 1 ? "caso" : "casos"}
              </span>
              <span className="text-label-sm text-tertiary block mt-0.5">{inconsistencias > 0 ? "Necessitam validação" : "Nenhum pendente"}</span>
            </div>
            <div className="p-3 bg-surface-container-low rounded-lg">
              <span className="text-label-sm text-on-surface-variant block">Fechamento do Quadrimestre</span>
              <span className="text-headline-sm font-bold text-primary">{diasParaFechamento >= 0 ? `${diasParaFechamento} dias` : "Encerrado"}</span>
              <span className="text-label-sm text-on-surface-variant block mt-0.5">
                Até {fim.toLocaleDateString("pt-BR")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Cards de indicadores */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
          <h3 className="text-headline-sm text-on-surface font-semibold flex items-center gap-2">
            <Icon name="checklist" className="text-primary text-body-lg" />
            Indicadores do Eixo {ABAS.find((a) => a.chave === aba)?.rotulo}
          </h3>
          <span className="text-label-md text-on-surface-variant">{rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}</span>
        </div>

        {indicadores.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
            Nenhum indicador cadastrado para este eixo.
          </div>
        ) : (
          indicadores.map((ind) => (
            <IndicadorCard
              key={ind.id}
              indicador={ind}
              expandido={ind.id === params.indicador}
              hrefExpandir={hrefIndicador(ind.id)}
              hrefRecolher={hrefIndicador(null)}
              listaNominal={ind.id === params.indicador ? listaNominal : null}
              escopoDrillDown={params.equipe ? "equipe selecionada" : "todas as equipes do eixo"}
            />
          ))
        )}
      </div>
    </div>
  );
}
