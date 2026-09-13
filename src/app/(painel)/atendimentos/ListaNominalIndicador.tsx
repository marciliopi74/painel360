import { Icon } from "@/components/Icon";
import type { LinhaBoaPratica, LinhaC1 } from "@/lib/data/listaNominal";

function formatarData(data: Date | null): string {
  return data ? data.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

// nu_cpf no e-SUS vem só com os 11 dígitos, sem máscara — formata ###.###.###-##. Se por
// algum motivo não vier com exatamente 11 dígitos (dado incompleto/malformado), mostra cru em
// vez de aplicar uma máscara errada.
function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function Identificador({ identificador, usaCpf }: { identificador: string; usaCpf: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant text-label-sm font-semibold shrink-0">{usaCpf ? "CPF" : "CNS"}</span>
      <span className="font-mono text-label-md text-on-surface">{usaCpf ? formatarCpf(identificador) : identificador}</span>
    </div>
  );
}

function ChipsCriterios({ criterios, atingiu }: { criterios: { codigo: string; descricao: string }[]; atingiu: boolean }) {
  if (criterios.length === 0) return <span className="text-on-surface-variant/60">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {criterios.map((c) => (
        <span
          key={c.codigo}
          title={c.descricao}
          className={`px-1.5 py-0.5 rounded text-label-sm font-bold ${atingiu ? "bg-secondary-container/50 text-secondary" : "bg-error-container/40 text-error"}`}
        >
          {c.codigo}
        </span>
      ))}
    </div>
  );
}

function CelulasCabecalho({
  linha,
}: {
  linha: { nome: string; identificador: string; usaCpf: boolean; dataNascimento: Date | null; dataUltimoAtendimento: Date | null; microarea: string | null; equipeNome: string };
}) {
  return (
    <>
      <td className="py-3 px-4">
        <div className="font-semibold text-on-surface text-label-md">{linha.nome}</div>
        <Identificador identificador={linha.identificador} usaCpf={linha.usaCpf} />
      </td>
      <td className="py-3 px-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatarData(linha.dataNascimento)}</td>
      <td className="py-3 px-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatarData(linha.dataUltimoAtendimento)}</td>
      <td className="py-3 px-3 text-body-sm text-on-surface-variant text-center">{linha.microarea ?? "—"}</td>
      <td className="py-3 px-3 text-body-sm text-on-surface">{linha.equipeNome}</td>
    </>
  );
}

export function ListaNominalIndicador({ dados }: { dados: { tipo: "c1"; linhas: LinhaC1[] } | { tipo: "boa_pratica"; linhas: LinhaBoaPratica[] } }) {
  if (dados.linhas.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
        Nenhum paciente elegível para este indicador no período selecionado.
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-surface-container-low/60 border-b border-outline-variant/40 text-on-surface-variant text-label-sm uppercase tracking-wider">
              <th className="py-3 px-4">Paciente</th>
              <th className="py-3 px-3">Nascimento</th>
              <th className="py-3 px-3">Último atendimento</th>
              <th className="py-3 px-3 text-center">Microárea</th>
              <th className="py-3 px-3">Equipe</th>
              {dados.tipo === "c1" ? (
                <th className="py-3 px-3">Consulta programada</th>
              ) : (
                <>
                  <th className="py-3 px-3">Boas práticas atingidas</th>
                  <th className="py-3 px-3">Boas práticas não atingidas</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30 text-body-md">
            {dados.tipo === "c1"
              ? dados.linhas.map((linha) => (
                  <tr key={linha.cidadaoCns} className="hover:bg-surface-container-low/30 transition-colors">
                    <CelulasCabecalho linha={linha} />
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-semibold ${
                          linha.consultaProgramada ? "bg-secondary-container/50 text-secondary" : "bg-surface-container text-on-surface-variant"
                        }`}
                      >
                        <Icon name={linha.consultaProgramada ? "check_circle" : "cancel"} className="text-body-sm" />
                        {linha.consultaProgramada ? "Sim" : "Não"}
                      </span>
                      <div className="text-label-sm text-on-surface-variant mt-0.5">{linha.tipoAtendimento}</div>
                    </td>
                  </tr>
                ))
              : dados.linhas.map((linha) => (
                  <tr key={linha.cidadaoCns} className="hover:bg-surface-container-low/30 transition-colors">
                    <CelulasCabecalho linha={linha} />
                    <td className="py-3 px-3 max-w-xs">
                      <ChipsCriterios criterios={linha.atingidas} atingiu={true} />
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      <ChipsCriterios criterios={linha.naoAtingidas} atingiu={false} />
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
