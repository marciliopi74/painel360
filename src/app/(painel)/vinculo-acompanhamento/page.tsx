import type { Quadrimestre } from "@prisma/client";
import { auth } from "@/lib/auth";
import { Icon } from "@/components/Icon";
import { CLASSIFICACAO } from "@/lib/ui/classificacao";
import { podeGerenciarUsuarios } from "@/lib/rbac";
import { quadrimestreAtual, rotuloQuadrimestre, listarPeriodosDisponiveis } from "@/lib/data/periodo";
import {
  listarResultadosVinculoAcompanhamento,
  obterPopulacaoMunicipio,
  listarBeneficiariosVulneraveis,
} from "@/lib/data/vinculoAcompanhamento";
import { SeletorPeriodo } from "../SeletorPeriodo";
import { PainelConfiguracao } from "./PainelConfiguracao";
import { SatisfacaoInput } from "./SatisfacaoInput";

function formatarNumero(n: number): string {
  return n.toLocaleString("pt-BR");
}

export default async function VinculoAcompanhamentoPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const usuario = session!.user;
  const podeEditar = podeGerenciarUsuarios(usuario);

  const [anoParam, quadParam] = (params.periodo ?? "").split("-");
  const periodo: { quadrimestre: Quadrimestre; ano: number } =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();

  const [resultados, populacao, beneficiarios, periodosDisponiveis] = await Promise.all([
    listarResultadosVinculoAcompanhamento(usuario, periodo.quadrimestre, periodo.ano),
    obterPopulacaoMunicipio(),
    podeEditar ? listarBeneficiariosVulneraveis() : Promise.resolve([]),
    listarPeriodosDisponiveis(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-headline-lg text-on-surface tracking-tight">Vínculo e Acompanhamento Territorial</h1>
          <p className="text-body-md text-on-surface-variant mt-0.5">
            Nota Técnica nº 30/2025-CGESCO/DESCO/SAPS/MS — Dimensão Cadastro (30%) + Dimensão Acompanhamento (70%), por equipe ESF/eAP.
          </p>
        </div>
        <SeletorPeriodo
          selecionado={`${periodo.ano}-${periodo.quadrimestre}`}
          periodos={periodosDisponiveis.map((p) => ({ valor: `${p.ano}-${p.quadrimestre}`, rotulo: rotuloQuadrimestre(p.quadrimestre, p.ano) }))}
        />
      </div>

      <div className="rounded-xl p-4 bg-tertiary-container/15 border border-tertiary/30 flex gap-3">
        <Icon name="info" className="text-tertiary text-body-lg shrink-0 mt-0.5" />
        <p className="text-body-sm text-on-surface">
          <strong>Estimativa gerencial interna, não é o cálculo oficial do SISAB/Ministério da Saúde.</strong> Esta instalação do e-SUS não
          tem acesso a alguns dados que a Nota Técnica 30 usa (CadÚnico, Meu SUS Digital, vínculo pessoa↔domicílio) — as aproximações
          aplicadas estão documentadas em <code className="text-label-sm">sql/11_vinculo_acompanhamento.sql</code>. Em especial: o fator de
          multiplicação do cadastro usa sempre 0,75 (nunca o 1,5 de MICI+MICDT), e a exclusão de &quot;Mudança de território&quot; não é
          aplicada.
        </p>
      </div>

      {populacao === null && (
        <div className="rounded-xl p-4 bg-error-container/30 border border-error/30 flex gap-3">
          <Icon name="warning" className="text-error text-body-lg shrink-0 mt-0.5" />
          <p className="text-body-sm text-on-surface">
            <strong>População do município não configurada.</strong> Sem ela não é possível calcular o parâmetro por porte populacional —
            nenhum resultado aparece abaixo até isso ser preenchido{podeEditar ? " no painel abaixo" : " por um gestor local"}.
          </p>
        </div>
      )}

      {podeEditar && <PainelConfiguracao populacaoAtual={populacao} beneficiarios={beneficiarios} />}

      {resultados.length === 0 ? (
        <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
          Nenhum resultado calculado para este período ainda.
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/60 border-b border-outline-variant/40 text-on-surface-variant text-label-sm uppercase tracking-wider">
                  <th className="py-3 px-4">Equipe</th>
                  <th className="py-3 px-3 text-center">Cadastro (X)</th>
                  <th className="py-3 px-3 text-center">Escore Cadastro</th>
                  <th className="py-3 px-3 text-center">Acompanhamento (Y)</th>
                  <th className="py-3 px-3 text-center">Satisfação</th>
                  <th className="py-3 px-3 text-center">Escore Acompanhamento</th>
                  <th className="py-3 px-3 text-center">Escore Final</th>
                  <th className="py-3 px-3 text-center">Classificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-body-md">
                {resultados.map((r) => {
                  const corFinal = CLASSIFICACAO[r.classificacaoFinal];
                  return (
                    <tr key={r.equipeId} className="hover:bg-surface-container-low/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-on-surface text-label-md">{r.equipeNome}</div>
                        <div className="text-label-sm text-on-surface-variant">{r.equipeTipo}</div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-on-surface">{r.resultadoCadastro}%</div>
                        <div className="text-label-sm text-on-surface-variant">
                          {formatarNumero(r.pessoasCadastroValido)} pessoas / parâmetro {formatarNumero(r.parametroPorte)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-label-sm font-bold ${CLASSIFICACAO[r.classificacaoCadastro].fundo} ${CLASSIFICACAO[r.classificacaoCadastro].texto}`}>
                          {r.escoreCadastro.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="font-semibold text-on-surface">{r.resultadoAcompanhamento}%</div>
                        <div className="text-label-sm text-on-surface-variant" title="Sem critério / Idoso ou criança / BPC-PBF / Idoso-criança+BPC-PBF">
                          {r.acompanhadosSemCriterio}·{r.acompanhadosIdosoOuCrianca}·{r.acompanhadosBpcPbf}·{r.acompanhadosIdosoCriancaBpcPbf}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {podeEditar ? (
                          <SatisfacaoInput equipeId={r.equipeId} quadrimestre={periodo.quadrimestre} ano={periodo.ano} valorAtual={r.percentualAvaliacoes} />
                        ) : (
                          <span className="text-body-sm text-on-surface-variant">{r.percentualAvaliacoes !== null ? `${r.percentualAvaliacoes}%` : "—"}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-label-sm font-bold ${CLASSIFICACAO[r.classificacaoAcompanhamento].fundo} ${CLASSIFICACAO[r.classificacaoAcompanhamento].texto}`}>
                          {r.escoreAcompanhamento.toFixed(2)}
                        </span>
                        {r.bonusSatisfacao > 0 && <div className="text-label-sm text-secondary mt-0.5">+{r.bonusSatisfacao.toFixed(2)} bônus</div>}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-on-surface">{r.escoreFinal.toFixed(2)} / 10</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-label-sm font-bold ${corFinal.fundo} ${corFinal.texto}`}>
                          <span className={`w-2 h-2 rounded-full ${corFinal.ponto}`} />
                          {corFinal.rotulo}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
