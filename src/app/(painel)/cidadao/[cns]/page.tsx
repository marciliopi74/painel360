import { notFound } from "next/navigation";
import type { Quadrimestre } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { obterCidadao, listarCriteriosPrevine } from "@/lib/data/cidadao";
import { ROTULO_ERRO, SUGESTOES_ERRO } from "@/lib/data/erros";
import { quadrimestreAtual, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import { CopiarBotao } from "../CopiarBotao";
import { SeletorPeriodo } from "../../SeletorPeriodo";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

export default async function CidadaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ cns: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { cns } = await params;
  const { periodo: periodoParam } = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const cadastro = await obterCidadao(usuario, decodeURIComponent(cns));
  if (!cadastro) notFound();

  const [anoParam, quadParam] = (periodoParam ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();

  const [criterios, periodosDisponiveis] = await Promise.all([
    listarCriteriosPrevine(cadastro.cidadaoCns, periodo.quadrimestre, periodo.ano),
    listarPeriodosDisponiveis(),
  ]);

  const porIndicador = new Map<string, { codigo: string; nome: string; criterios: typeof criterios }>();
  for (const c of criterios) {
    const entrada = porIndicador.get(c.indicadorId) ?? { codigo: c.indicadorCodigo, nome: c.indicadorNome, criterios: [] };
    entrada.criterios.push(c);
    porIndicador.set(c.indicadorId, entrada);
  }
  const gruposIndicador = [...porIndicador.values()];
  const nome = cadastro.cidadaoNome ?? `CNS ${cadastro.cidadaoCns}`;

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      {cadastro.temErro && (
        <section className="rounded-lg bg-[#FDF0ED] border border-[#E5533C]/40 p-3.5 shadow-sm">
          <div className="flex items-start gap-2.5">
            <Icon name="warning" className="text-[#B8321D] text-[22px] shrink-0 mt-0.5" filled />
            <div className="space-y-1.5 flex-1">
              <span className="text-label-sm font-bold text-[#B8321D] tracking-wide uppercase">Pendência de sincronização e-SUS</span>
              <p className="text-body-sm text-[#732014] font-medium leading-snug">
                {ROTULO_ERRO[cadastro.tipoErro ?? ""] ?? cadastro.tipoErro}
                {cadastro.tipoErro && SUGESTOES_ERRO[cadastro.tipoErro] && `: ${SUGESTOES_ERRO[cadastro.tipoErro]}`}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Identificação */}
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-4 shadow-sm space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-headline-sm shrink-0 shadow-sm border border-primary/20">
            {iniciais(nome)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-headline-sm text-on-surface font-bold truncate">{nome}</h2>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-label-sm bg-surface-container-low text-primary px-2 py-0.5 rounded font-mono font-semibold">CNS: {cadastro.cidadaoCns}</span>
              <CopiarBotao valor={cadastro.cidadaoCns} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 pt-2 border-t border-outline-variant/20 text-body-sm">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-on-surface-variant text-label-md">Equipe:</span>
            <span className="font-medium text-on-surface text-label-md">
              {cadastro.equipe.nome} ({cadastro.equipe.tipo})
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-on-surface-variant text-label-md">Cadastrado por:</span>
            <span className="font-medium text-on-surface text-label-md">
              {cadastro.profissional.nome}
              {cadastro.profissional.ehAcs ? " (ACS)" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-on-surface-variant text-label-md">Data de cadastro:</span>
            <span className="font-medium text-on-surface text-label-md">{cadastro.dataCadastro.toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-on-surface-variant text-label-md">Status e-SUS:</span>
            {cadastro.temErro ? (
              <span className="inline-flex items-center gap-1 bg-[#FDF0ED] text-[#B8321D] text-label-sm px-2 py-0.5 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#E5533C]" />
                {ROTULO_ERRO[cadastro.tipoErro ?? ""] ?? "Com pendência"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 bg-[#EAF8F1] text-[#1E824C] text-label-sm px-2 py-0.5 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2FBF71]" />
                Conforme
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Previne Brasil */}
      <section className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Icon name="analytics" className="text-primary" />
            <h3 className="text-label-lg text-on-surface font-semibold">Critérios Previne Brasil</h3>
          </div>
          <SeletorPeriodo
            selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
            periodos={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
          />
        </div>

        {gruposIndicador.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            Nenhum critério de boa prática pontuada (C2-C7) registrado para esta pessoa em {rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}.
          </p>
        ) : (
          gruposIndicador.map((grupo) => {
            const total = grupo.criterios.length;
            const atingidos = grupo.criterios.filter((c) => c.atingiu).length;
            const completo = atingidos === total;
            return (
              <div
                key={grupo.codigo}
                className={`p-3 rounded-lg border ${completo ? "bg-[#EAF8F1] border-[#2FBF71]/30" : "bg-[#FEF6EE] border-[#F4A261]/40"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`text-label-sm font-bold ${completo ? "text-[#1E824C]" : "text-[#B25E16]"}`}>
                      {grupo.codigo} • {grupo.nome}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 bg-white text-label-sm px-2 py-0.5 rounded font-bold shadow-xs shrink-0 ${
                      completo ? "text-[#1E824C]" : "text-[#B25E16]"
                    }`}
                  >
                    <Icon name={completo ? "check" : "schedule"} className="text-[14px]" />
                    {atingidos}/{total}
                  </span>
                </div>
                <div className="w-full bg-white/70 h-2 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full ${completo ? "bg-[#2FBF71]" : "bg-[#F4A261]"}`} style={{ width: `${(atingidos / total) * 100}%` }} />
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {grupo.criterios.map((c) => (
                    <li
                      key={c.criterioCodigo}
                      title={c.criterioDescricao}
                      className={`px-2 py-0.5 rounded text-label-sm font-medium ${
                        c.atingiu ? "bg-white text-[#1E824C]" : "bg-white/60 text-[#B25E16]"
                      }`}
                    >
                      {c.criterioCodigo}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
