import { Icon } from "@/components/Icon";
import type { ResultadoListaNominalIndicador } from "@/lib/data/listaNominal";

function formatarData(data: Date | null): string {
  return data ? data.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

// nu_cpf no e-SUS vem só com os 11 dígitos, sem máscara — formata ###.###.###-##. Se por algum
// motivo não vier com exatamente 11 dígitos (dado incompleto/malformado), mostra cru em vez de
// aplicar uma máscara errada.
function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}

function Identificador({ identificador, usaCpf }: { identificador: string | null; usaCpf: boolean }) {
  if (!identificador) return <span className="text-on-surface-variant/60 text-label-sm">Sem paciente único (sessão em grupo)</span>;
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

function BadgeSimNao({ valor, rotuloSim = "Sim", rotuloNao = "Não" }: { valor: boolean; rotuloSim?: string; rotuloNao?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm font-semibold ${
        valor ? "bg-secondary-container/50 text-secondary" : "bg-surface-container text-on-surface-variant"
      }`}
    >
      <Icon name={valor ? "check_circle" : "cancel"} className="text-body-sm" />
      {valor ? rotuloSim : rotuloNao}
    </span>
  );
}

function CelulasCabecalho({
  nome,
  identificador,
  usaCpf,
  dataNascimento,
  dataUltimoAtendimento,
  microarea,
  equipeNome,
}: {
  nome: string;
  identificador: string | null;
  usaCpf: boolean;
  dataNascimento: Date | null;
  // opcional: só passado (e só a coluna correspondente exibida) pelas tabelas "boa_pratica" e
  // "pessoa_evento" — a tabela "evento" já tem uma coluna "Data do evento" equivalente por
  // linha, então não precisa repetir aqui.
  dataUltimoAtendimento?: Date | null;
  microarea: string | null;
  equipeNome: string;
}) {
  return (
    <>
      <td className="py-3 px-4">
        <div className="font-semibold text-on-surface text-label-md">{nome}</div>
        <Identificador identificador={identificador} usaCpf={usaCpf} />
      </td>
      <td className="py-3 px-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatarData(dataNascimento)}</td>
      {dataUltimoAtendimento !== undefined && (
        <td className="py-3 px-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatarData(dataUltimoAtendimento)}</td>
      )}
      <td className="py-3 px-3 text-body-sm text-on-surface-variant text-center">{microarea ?? "—"}</td>
      <td className="py-3 px-3 text-body-sm text-on-surface">{equipeNome}</td>
    </>
  );
}

// Lista nominal por indicador na tela de Indicadores de Qualidade (2026-09-13) — cobre os 3
// formatos reais: "boa_pratica" (C2-C7, critérios individuais atingidos/não atingidos),
// "pessoa_evento" (C1, B1, B2, B4 — população elegível + um evento sim/não) e "evento" (B3, B5,
// B6, M1, M2 — log de procedimentos/atendimentos, já que esses contam eventos, não pessoas
// distintas; ver comentário em src/lib/data/listaNominal.ts).
export function ListaNominalIndicador({ dados }: { dados: ResultadoListaNominalIndicador }) {
  if (dados.linhas.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
        Nenhum registro elegível para este indicador no período selecionado.
      </div>
    );
  }

  if (dados.tipo === "evento") {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-outline-variant/40 text-on-surface-variant text-label-sm uppercase tracking-wider">
                <th className="py-3 px-4">Paciente</th>
                <th className="py-3 px-3">Nascimento</th>
                <th className="py-3 px-3 text-center">Microárea</th>
                <th className="py-3 px-3">Equipe</th>
                <th className="py-3 px-3">Data do evento</th>
                <th className="py-3 px-3">Evento</th>
                <th className="py-3 px-3">Conta para o numerador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-body-md">
              {dados.linhas.map((linha, i) => (
                <tr key={`${linha.cidadaoCns ?? "sessao"}-${i}`} className="hover:bg-surface-container-low/30 transition-colors">
                  <CelulasCabecalho
                    nome={linha.nome}
                    identificador={linha.identificador}
                    usaCpf={linha.usaCpf}
                    dataNascimento={linha.dataNascimento}
                    microarea={linha.microarea}
                    equipeNome={linha.equipeNome}
                  />
                  <td className="py-3 px-3 text-body-sm text-on-surface-variant whitespace-nowrap">{formatarData(linha.dataEvento)}</td>
                  <td className="py-3 px-3 text-body-sm text-on-surface">{linha.descricaoEvento}</td>
                  <td className="py-3 px-3">
                    <BadgeSimNao valor={linha.contaNumerador} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
              {dados.tipo === "pessoa_evento" ? (
                <th className="py-3 px-3">Atingiu até o último atendimento</th>
              ) : (
                <>
                  <th className="py-3 px-3">Boas práticas atingidas</th>
                  <th className="py-3 px-3">Boas práticas não atingidas</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30 text-body-md">
            {dados.tipo === "pessoa_evento"
              ? dados.linhas.map((linha) => (
                  <tr key={linha.cidadaoCns} className="hover:bg-surface-container-low/30 transition-colors">
                    <CelulasCabecalho
                      nome={linha.nome}
                      identificador={linha.identificador}
                      usaCpf={linha.usaCpf}
                      dataNascimento={linha.dataNascimento}
                      dataUltimoAtendimento={linha.dataUltimoAtendimento}
                      microarea={linha.microarea}
                      equipeNome={linha.equipeNome}
                    />
                    <td className="py-3 px-3">
                      <BadgeSimNao valor={linha.atingiu} />
                      <div className="text-label-sm text-on-surface-variant mt-0.5">{linha.rotuloEvento}</div>
                    </td>
                  </tr>
                ))
              : dados.linhas.map((linha) => (
                  <tr key={linha.cidadaoCns} className="hover:bg-surface-container-low/30 transition-colors">
                    <CelulasCabecalho
                      nome={linha.nome}
                      identificador={linha.identificador}
                      usaCpf={linha.usaCpf}
                      dataNascimento={linha.dataNascimento}
                      dataUltimoAtendimento={linha.dataUltimoAtendimento}
                      microarea={linha.microarea}
                      equipeNome={linha.equipeNome}
                    />
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
