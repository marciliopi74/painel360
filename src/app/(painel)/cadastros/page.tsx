import { auth } from "@/lib/auth";
import { listarCadastrosIndividuais, listarCadastrosDomiciliares, SUGESTOES_ERRO } from "@/lib/data/cadastros";

function Tabela({
  titulo,
  linhas,
  colunaExtra,
}: {
  titulo: string;
  colunaExtra: string;
  linhas: {
    id: string;
    valorExtra: string;
    profissional: string;
    equipe: string;
    data: Date;
    temErro: boolean;
    tipoErro: string | null;
  }[];
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">{titulo}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 pr-3">{colunaExtra}</th>
              <th className="py-2 pr-3">ACS/Profissional</th>
              <th className="py-2 pr-3">Equipe</th>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-center text-zinc-400">
                  Nenhum registro.
                </td>
              </tr>
            )}
            {linhas.map((l) => (
              <tr key={l.id} className="border-b border-zinc-100 align-top">
                <td className="py-2 pr-3">{l.valorExtra}</td>
                <td className="py-2 pr-3">{l.profissional}</td>
                <td className="py-2 pr-3">{l.equipe}</td>
                <td className="py-2 pr-3">{l.data.toLocaleDateString("pt-BR")}</td>
                <td className="py-2 pr-3">
                  {l.temErro ? (
                    <div>
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        {l.tipoErro}
                      </span>
                      {l.tipoErro && SUGESTOES_ERRO[l.tipoErro] && (
                        <p className="mt-1 text-xs text-zinc-500">{SUGESTOES_ERRO[l.tipoErro]}</p>
                      )}
                    </div>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      OK
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function CadastrosPage() {
  const session = await auth();
  const usuario = session!.user;

  const [individuais, domiciliares] = await Promise.all([
    listarCadastrosIndividuais(usuario),
    listarCadastrosDomiciliares(usuario),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Cadastros</h1>
        <p className="text-sm text-zinc-500">
          Cadastros individuais e domiciliares por ACS, com detecção automática de erros e sugestão de correção.
        </p>
      </div>

      <Tabela
        titulo="Cadastros individuais"
        colunaExtra="CNS do cidadão"
        linhas={individuais.map((c) => ({
          id: c.id,
          valorExtra: c.cidadaoCns,
          profissional: c.profissional.nome,
          equipe: `${c.equipe.nome} (${c.equipe.tipo})`,
          data: c.dataCadastro,
          temErro: c.temErro,
          tipoErro: c.tipoErro,
        }))}
      />

      <Tabela
        titulo="Cadastros domiciliares"
        colunaExtra="Endereço de referência"
        linhas={domiciliares.map((c) => ({
          id: c.id,
          valorExtra: c.enderecoReferencia,
          profissional: c.profissional.nome,
          equipe: `${c.equipe.nome} (${c.equipe.tipo})`,
          data: c.dataCadastro,
          temErro: c.temErro,
          tipoErro: c.tipoErro,
        }))}
      />
    </div>
  );
}
