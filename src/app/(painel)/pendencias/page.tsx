import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { listarPendencias, obterResumoPendencias, ITENS_POR_PAGINA } from "@/lib/data/pendencias";
import { listarEquipesVisiveis } from "@/lib/data/equipes";
import { FiltrosPendencias } from "./FiltrosPendencias";
import { PendenciaCard } from "./PendenciaCard";
import { Paginacao } from "../cadastros/Paginacao";

export default async function PendenciasPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; equipe?: string; tipoErro?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const busca = params.busca ?? "";
  const equipe = params.equipe ?? "";
  const tipoErro = params.tipoErro ?? "";
  const pagina = Number(params.pagina ?? "1") || 1;

  const filtrosBase = { busca: busca || undefined, equipeId: equipe || undefined };

  const [resumo, resultado, opcoesEquipe] = await Promise.all([
    obterResumoPendencias(usuario, filtrosBase),
    listarPendencias(usuario, { ...filtrosBase, tipoErro: tipoErro || undefined, pagina }),
    listarEquipesVisiveis(usuario),
  ]);

  const paramsExport = new URLSearchParams();
  if (busca) paramsExport.set("busca", busca);
  if (equipe) paramsExport.set("equipe", equipe);
  if (tipoErro) paramsExport.set("tipoErro", tipoErro);

  const outrosParamsPaginacao = new URLSearchParams();
  if (busca) outrosParamsPaginacao.set("busca", busca);
  if (equipe) outrosParamsPaginacao.set("equipe", equipe);
  if (tipoErro) outrosParamsPaginacao.set("tipoErro", tipoErro);

  return (
    <div className="flex flex-col gap-5">
      {/* Hero de alerta */}
      <section className="bg-[#FEECEB] border border-red-200 rounded-xl p-4 sm:p-6 shadow-sm relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-5 pointer-events-none text-red-900">
          <Icon name="warning" className="text-[180px]" />
        </div>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 relative z-10">
          <div className="space-y-1.5 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-label-sm">
              <Icon name="error" className="text-body-md text-[#E5533C]" />
              Auditoria contínua de cadastros e atendimentos
            </div>
            <h1 className="text-headline-md sm:text-headline-lg text-[#93000a] tracking-tight">
              Central de Pendências ({resumo.total.toLocaleString("pt-BR")} registros)
            </h1>
            <p className="text-body-md text-red-900 leading-relaxed">
              Cadastros individuais, domiciliares e atendimentos com inconsistência detectada automaticamente na sincronização com o e-SUS.
              A correção acontece no e-SUS PEC — a próxima sincronização (a cada 10 min) atualiza o status aqui sozinha.
            </p>
          </div>
          <a
            href={`/api/pendencias/exportar?${paramsExport.toString()}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-surface-container-lowest border border-red-300 text-red-900 text-label-md hover:bg-red-50 active:scale-95 transition-all shadow-sm shrink-0"
          >
            <Icon name="file_download" className="text-body-lg" />
            Exportar CSV
          </a>
        </div>

        {resumo.porTipoErro.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-red-200/80 relative z-10">
            {resumo.porTipoErro.slice(0, 4).map((cat) => (
              <div key={cat.tipoErro} className="bg-surface-container-lowest/90 p-3 rounded-lg border border-red-100">
                <span className="text-label-sm text-on-surface-variant block">{cat.rotulo}</span>
                <div className="text-headline-sm font-bold text-on-surface mt-0.5">{cat.contagem.toLocaleString("pt-BR")}</div>
                <span className="text-label-sm text-red-700 font-medium">
                  {((cat.contagem / resumo.total) * 100).toFixed(1)}% do total
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <FiltrosPendencias
        buscaInicial={busca}
        equipeSelecionada={equipe}
        tipoErroSelecionado={tipoErro}
        opcoesEquipe={opcoesEquipe}
        categorias={resumo.porTipoErro}
        total={resumo.total}
      />

      <div className="flex flex-col gap-3">
        {resultado.pendencias.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-8 text-center text-body-sm text-on-surface-variant">
            {resumo.total === 0 ? "Nenhuma pendência encontrada — tudo em conformidade." : "Nenhum registro para esse filtro."}
          </div>
        )}
        {resultado.pendencias.map((p) => (
          <PendenciaCard key={`${p.origem}-${p.id}`} pendencia={p} />
        ))}
      </div>

      <Paginacao
        pagina={resultado.pagina}
        totalPaginas={resultado.totalPaginas}
        total={resultado.total}
        itensNaPagina={resultado.pendencias.length}
        itensPorPagina={ITENS_POR_PAGINA}
        paramNome="pagina"
        outrosParams={outrosParamsPaginacao}
      />
    </div>
  );
}
