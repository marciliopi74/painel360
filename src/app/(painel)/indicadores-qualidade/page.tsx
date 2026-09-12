import Link from "next/link";
import { auth } from "@/lib/auth";
import { listarResultados, listarDrillDownIndicador } from "@/lib/data/indicadores";
import { quadrimestreAtual } from "@/lib/data/periodo";
import type { TipoEquipeAlvo } from "@prisma/client";

const ABAS: { chave: TipoEquipeAlvo; rotulo: string }[] = [
  { chave: "ESF_EAP", rotulo: "ESF / eAP" },
  { chave: "ESB", rotulo: "eSB" },
  { chave: "EMULTI", rotulo: "eMulti" },
];

const COR_CLASSIFICACAO: Record<string, string> = {
  otimo: "bg-emerald-100 text-emerald-700",
  bom: "bg-lime-100 text-lime-700",
  suficiente: "bg-amber-100 text-amber-700",
  regular: "bg-red-100 text-red-700",
};

export default async function IndicadoresQualidadePage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; equipe?: string; indicador?: string }>;
}) {
  const session = await auth();
  const usuario = session!.user;
  const params = await searchParams;
  const aba = (ABAS.find((a) => a.chave === params.aba)?.chave ?? "ESF_EAP") as TipoEquipeAlvo;
  const { quadrimestre, ano } = quadrimestreAtual();

  const { indicadores, equipes, porChave } = await listarResultados(usuario, aba, quadrimestre, ano);

  const drillDown =
    params.equipe && params.indicador
      ? await listarDrillDownIndicador(params.equipe, params.indicador, quadrimestre, ano)
      : null;
  const indicadorDrillDown = indicadores.find((i) => i.id === params.indicador);
  const equipeDrillDown = equipes.find((e) => e.id === params.equipe);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Indicadores de Qualidade</h1>
        <p className="text-sm text-zinc-500">
          {quadrimestre}/{ano} — Previne Brasil. Clique em uma boa prática pontuada (C2-C7) para o drill-down por
          pessoa.
        </p>
      </div>

      <div className="flex gap-1 border-b border-zinc-200">
        {ABAS.map((a) => (
          <Link
            key={a.chave}
            href={`/indicadores-qualidade?aba=${a.chave}`}
            className={`rounded-t-md px-3 py-2 text-sm font-medium ${
              a.chave === aba ? "border-b-2 border-zinc-900 text-zinc-900" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 px-3">Equipe</th>
              {indicadores.map((ind) => (
                <th key={ind.id} className="py-2 px-3" title={ind.nome}>
                  {ind.codigo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipes.length === 0 && (
              <tr>
                <td colSpan={indicadores.length + 1} className="py-4 text-center text-zinc-400">
                  Nenhuma equipe deste tipo.
                </td>
              </tr>
            )}
            {equipes.map((eq) => (
              <tr key={eq.id} className="border-b border-zinc-100">
                <td className="py-2 px-3 font-medium text-zinc-900">{eq.nome}</td>
                {indicadores.map((ind) => {
                  const resultado = porChave.get(`${eq.id}:${ind.id}`);
                  const podeDrillDown = ind.categoria === "boa_pratica_pontuada" && resultado;
                  const conteudo = resultado ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${COR_CLASSIFICACAO[resultado.classificacao]}`}
                    >
                      {Number(resultado.valorCalculado).toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-300">—</span>
                  );
                  return (
                    <td key={ind.id} className="py-2 px-3">
                      {podeDrillDown ? (
                        <Link
                          href={`/indicadores-qualidade?aba=${aba}&equipe=${eq.id}&indicador=${ind.id}`}
                          className="hover:opacity-70"
                        >
                          {conteudo}
                        </Link>
                      ) : (
                        conteudo
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {drillDown && indicadorDrillDown && equipeDrillDown && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">
            Drill-down — {indicadorDrillDown.codigo} ({indicadorDrillDown.nome}) — {equipeDrillDown.nome}
          </h2>
          {drillDown.size === 0 ? (
            <p className="mt-2 text-sm text-zinc-400">Nenhum registro de pontuação por pessoa neste período.</p>
          ) : (
            <table className="mt-3 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500">
                  <th className="py-2 pr-3">CNS do cidadão</th>
                  <th className="py-2 pr-3">Critérios atingidos</th>
                </tr>
              </thead>
              <tbody>
                {[...drillDown.entries()].map(([cns, pontuacoes]) => (
                  <tr key={cns} className="border-b border-zinc-100 align-top">
                    <td className="py-2 pr-3 font-mono text-xs">{cns}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {pontuacoes.map((p) => (
                          <span
                            key={p.id}
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              p.atingiu ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                            }`}
                            title={p.criterio.descricao}
                          >
                            {p.criterio.codigoCriterio}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
