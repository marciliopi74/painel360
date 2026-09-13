import Link from "next/link";
import type { TipoRelatorio } from "@prisma/client";
import { auth } from "@/lib/auth";
import { podeDispararSincronizacao } from "@/lib/rbac";
import { Icon } from "@/components/Icon";
import { listarRelatorios, contarRelatoriosPorTipo, ITENS_POR_PAGINA } from "@/lib/data/relatorios";
import { obterMediaIndicadoresGeral } from "@/lib/data/indicadores";
import { quadrimestreAtual, rotuloQuadrimestre } from "@/lib/data/periodo";
import { GerarRelatorioPanel } from "./GerarRelatorioPanel";
import { RelatorioItem } from "./RelatorioItem";
import { Paginacao } from "../cadastros/Paginacao";

const CHIPS: { valor: TipoRelatorio | "todos"; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "diario", rotulo: "Diário" },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "quadrimestral", rotulo: "Quadrimestral" },
];

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const tipo = CHIPS.some((c) => c.valor === params.tipo) && params.tipo !== "todos" ? (params.tipo as TipoRelatorio) : undefined;
  const pagina = Number(params.pagina ?? "1") || 1;
  const periodo = quadrimestreAtual();

  const [{ relatorios, total, totalPaginas }, contagens, { media, apurados }] = await Promise.all([
    listarRelatorios({ tipo, pagina }),
    contarRelatoriosPorTipo(),
    obterMediaIndicadoresGeral(usuario, periodo.quadrimestre, periodo.ano),
  ]);

  const totalGeral = contagens.diario + contagens.semanal + contagens.quadrimestral;
  const outrosParams = new URLSearchParams();
  if (tipo) outrosParams.set("tipo", tipo);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-headline-lg text-on-surface tracking-tight">Central de Relatórios</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Relatórios gerados automaticamente (diário, semanal e avaliação quadrimestral) ou sob demanda.
        </p>
      </div>

      {/* Filtro por categoria */}
      <section className="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-4 md:p-5 shadow-sm">
        <label className="block text-label-md text-on-surface-variant mb-2">Categoria do Relatório</label>
        <div className="flex flex-wrap items-center gap-2">
          {CHIPS.map((chip) => {
            const ativo = chip.valor === "todos" ? !tipo : tipo === chip.valor;
            const contagem = chip.valor === "todos" ? totalGeral : contagens[chip.valor as TipoRelatorio];
            return (
              <Link
                key={chip.valor}
                href={chip.valor === "todos" ? "?" : `?tipo=${chip.valor}`}
                className={`px-3.5 py-2 rounded-full text-label-md transition-all duration-150 active:scale-95 flex items-center gap-1.5 ${
                  ativo ? "bg-primary-container text-on-primary-container shadow-sm font-bold" : "bg-surface-container-low text-on-surface hover:bg-surface-container border border-outline-variant/30"
                }`}
              >
                {ativo && <Icon name="check" className="text-body-sm" />}
                {chip.rotulo} ({contagem.toLocaleString("pt-BR")})
              </Link>
            );
          })}
        </div>
      </section>

      {/* Ação em destaque + mini card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 bg-gradient-to-br from-primary-container to-primary text-on-primary rounded-xl p-6 shadow-md relative overflow-hidden flex flex-col justify-between">
          <div className="relative z-10 space-y-3">
            <h2 className="text-headline-md text-white tracking-tight">Gerar Relatório Agora</h2>
            <p className="text-body-md text-on-primary-container max-w-2xl">
              Gera imediatamente o mesmo relatório que roda automaticamente (diariamente às 6h, semanalmente às segundas, e a avaliação
              quadrimestral no fechamento do período), já com os dados mais recentes sincronizados do e-SUS.
            </p>
          </div>
          <GerarRelatorioPanel podeGerar={podeDispararSincronizacao(usuario)} />
          <Icon name="analytics" className="absolute -right-6 -bottom-6 text-[180px] text-white/5 pointer-events-none select-none" />
        </section>

        <section className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-label-sm uppercase tracking-wider text-on-surface-variant font-semibold">
              Indicadores de Qualidade • {rotuloQuadrimestre(periodo.quadrimestre, periodo.ano)}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[32px] font-bold tracking-tight text-on-surface leading-none">{media ?? "—"}</span>
              {media !== null && <span className="text-body-sm text-on-surface-variant">% de média ({apurados} apurados)</span>}
            </div>
            {media !== null ? (
              <div className="space-y-1">
                <div className="w-full h-3 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(100, Math.max(0, media))}%` }} />
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  Cálculo interno — não é o Indicador Sintético Final (ISF) oficial do SISAB.
                </p>
              </div>
            ) : (
              <p className="text-body-sm text-on-surface-variant">Nenhum indicador percentual apurado ainda neste período.</p>
            )}
          </div>
          <div className="pt-4 mt-4 border-t border-outline-variant/30 flex items-center justify-between text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Icon name="info" className="text-body-md text-primary" />
              {totalGeral} {totalGeral === 1 ? "relatório gerado" : "relatórios gerados"}
            </span>
            <Link href="/indicadores-qualidade" className="text-primary hover:underline font-semibold">
              Ver detalhes
            </Link>
          </div>
        </section>
      </div>

      {/* Lista de relatórios */}
      <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Icon name="folder_shared" className="text-primary text-headline-sm" />
          <h2 className="text-headline-sm text-on-surface tracking-tight">Relatórios Gerados</h2>
        </div>
        <span className="text-label-md text-on-surface-variant">
          {total > 0 ? `Mostrando ${relatorios.length} de ${total.toLocaleString("pt-BR")}` : "Nenhum relatório"}
        </span>
      </div>

      <div className="space-y-3">
        {relatorios.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
            Nenhum relatório gerado ainda para esse filtro.
          </div>
        )}
        {relatorios.map((r) => (
          <RelatorioItem key={r.id} relatorio={r} />
        ))}
      </div>

      <Paginacao pagina={pagina} totalPaginas={totalPaginas} total={total} itensNaPagina={relatorios.length} itensPorPagina={ITENS_POR_PAGINA} paramNome="pagina" outrosParams={outrosParams} />
    </div>
  );
}
