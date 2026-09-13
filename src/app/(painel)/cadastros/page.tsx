import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import {
  listarCadastrosIndividuais,
  listarCadastrosDomiciliares,
  obterResumoCadastros,
  ITENS_POR_PAGINA,
  type StatusCadastro,
} from "@/lib/data/cadastros";
import { listarEquipesVisiveis } from "@/lib/data/equipes";
import { FiltrosCadastros } from "./FiltrosCadastros";
import { FichaCard } from "./FichaCard";
import { Paginacao } from "./Paginacao";

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

function percentual(parte: number, total: number): string {
  return total === 0 ? "—" : `${((parte / total) * 100).toFixed(1)}%`;
}

export default async function CadastrosPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; equipe?: string; status?: string; paginaInd?: string; paginaDom?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;

  const busca = params.busca ?? "";
  const equipe = params.equipe ?? "";
  const status = (params.status as StatusCadastro | undefined) ?? "todos";
  const paginaInd = Number(params.paginaInd ?? "1") || 1;
  const paginaDom = Number(params.paginaDom ?? "1") || 1;

  const filtrosBase = { busca: busca || undefined, equipeId: equipe || undefined };

  const [resumo, individuais, domiciliares, opcoesEquipe] = await Promise.all([
    obterResumoCadastros(usuario, filtrosBase),
    listarCadastrosIndividuais(usuario, { ...filtrosBase, status, pagina: paginaInd }),
    listarCadastrosDomiciliares(usuario, { ...filtrosBase, status, pagina: paginaDom }),
    listarEquipesVisiveis(usuario),
  ]);

  const paramsExport = new URLSearchParams();
  if (busca) paramsExport.set("busca", busca);
  if (equipe) paramsExport.set("equipe", equipe);
  if (status !== "todos") paramsExport.set("status", status);

  const outrosParamsPaginacao = new URLSearchParams();
  if (busca) outrosParamsPaginacao.set("busca", busca);
  if (equipe) outrosParamsPaginacao.set("equipe", equipe);
  if (status !== "todos") outrosParamsPaginacao.set("status", status);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-headline-sm font-bold text-on-surface">Cadastros e Território</h1>
          <p className="text-body-sm text-on-surface-variant mt-1">
            Qualificação de Cadastros Individuais e Domiciliares vindos do e-SUS.
          </p>
        </div>
        <a
          href={`/api/cadastros/exportar?${paramsExport.toString()}`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-outline-variant/60 hover:bg-surface-container text-on-surface-variant text-label-md transition whitespace-nowrap self-start"
        >
          <Icon name="file_download" className="text-body-md" />
          Exportar CSV
        </a>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant font-medium">Total de Cadastros</span>
            <span className="text-headline-lg text-on-surface font-bold mt-1">{formatarNumero(resumo.total)}</span>
            <span className="text-label-sm text-on-surface-variant mt-1">Individuais + domiciliares</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary shrink-0">
            <Icon name="how_to_reg" />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant font-medium">Cadastros Válidos</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-headline-lg text-secondary font-bold">{formatarNumero(resumo.validos)}</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm font-semibold">
                {percentual(resumo.validos, resumo.total)}
              </span>
            </div>
            <span className="text-label-sm text-on-surface-variant mt-1">Sem pendência detectada</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-secondary-container/40 flex items-center justify-center text-secondary shrink-0">
            <Icon name="verified" />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-error/20 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-label-md text-on-surface-variant font-medium">Com Pendência / Inconsistência</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-headline-lg text-error font-bold">{formatarNumero(resumo.comPendencia)}</span>
              <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-label-sm font-semibold">
                {percentual(resumo.comPendencia, resumo.total)}
              </span>
            </div>
            <span className="text-label-sm text-error mt-1 font-medium">Requer correção no e-SUS PEC</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-error-container/40 flex items-center justify-center text-error shrink-0">
            <Icon name="warning" />
          </div>
        </div>
      </section>

      <FiltrosCadastros
        buscaInicial={busca}
        equipeSelecionada={equipe}
        opcoesEquipe={opcoesEquipe}
        contagens={{ todos: resumo.total, comErro: resumo.comPendencia, semErro: resumo.validos }}
      />

      {/* Cadastros Individuais */}
      <section className="flex flex-col gap-3">
        <h2 className="text-label-lg font-bold text-on-surface uppercase tracking-wide">
          Cadastros Individuais <span className="text-on-surface-variant font-normal normal-case">({formatarNumero(individuais.total)})</span>
        </h2>
        {individuais.registros.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
            Nenhum cadastro individual encontrado para esse filtro.
          </div>
        )}
        {individuais.registros.map((c) => (
          <FichaCard
            key={c.id}
            icone="person_alert"
            iconeOk="check_circle"
            titulo={c.cidadaoNome ?? `CNS ${c.cidadaoCns}`}
            linkCns={c.cidadaoCns}
            detalhe={`CNS: ${c.cidadaoCns} • Tipo: Cadastro Individual • Data de Registro: ${c.dataCadastro.toLocaleDateString("pt-BR")}`}
            acs={c.profissional.nome}
            equipe={`${c.equipe.nome} (${c.equipe.tipo})`}
            temErro={c.temErro}
            tipoErro={c.tipoErro}
          />
        ))}
        <Paginacao
          pagina={individuais.pagina}
          totalPaginas={individuais.totalPaginas}
          total={individuais.total}
          itensNaPagina={individuais.registros.length}
          itensPorPagina={ITENS_POR_PAGINA}
          paramNome="paginaInd"
          outrosParams={outrosParamsPaginacao}
        />
      </section>

      {/* Cadastros Domiciliares */}
      <section className="flex flex-col gap-3">
        <h2 className="text-label-lg font-bold text-on-surface uppercase tracking-wide">
          Cadastros Domiciliares <span className="text-on-surface-variant font-normal normal-case">({formatarNumero(domiciliares.total)})</span>
        </h2>
        {domiciliares.registros.length === 0 && (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
            Nenhum cadastro domiciliar encontrado para esse filtro.
          </div>
        )}
        {domiciliares.registros.map((c) => (
          <FichaCard
            key={c.id}
            icone="home_work"
            iconeOk="home"
            titulo={c.enderecoReferencia}
            detalhe={`Tipo: Cadastro Domiciliar e Territorial • Data de Registro: ${c.dataCadastro.toLocaleDateString("pt-BR")}`}
            acs={c.profissional.nome}
            equipe={`${c.equipe.nome} (${c.equipe.tipo})`}
            temErro={c.temErro}
            tipoErro={c.tipoErro}
          />
        ))}
        <Paginacao
          pagina={domiciliares.pagina}
          totalPaginas={domiciliares.totalPaginas}
          total={domiciliares.total}
          itensNaPagina={domiciliares.registros.length}
          itensPorPagina={ITENS_POR_PAGINA}
          paramNome="paginaDom"
          outrosParams={outrosParamsPaginacao}
        />
      </section>
    </div>
  );
}
