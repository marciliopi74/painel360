import { prisma } from "@/lib/prisma";
import type { TipoEquipe } from "@prisma/client";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { quadrimestreAtual } from "@/lib/data/periodo";

export type ResumoPorTipoEquipe = {
  tipo: TipoEquipe;
  cadastrosIndividuais: number;
  visitasAcs: number;
  atendimentos: number;
  percentualMetaAtingida: number | null;
};

// requisitos 8-9: painel inicial segmentado por tipo de equipe (ESF, EAP, EMULTI, ESB).
export async function obterResumoDashboard(usuario: UsuarioSessao): Promise<ResumoPorTipoEquipe[]> {
  const equipeId = await equipeIdPermitido(usuario);
  const filtroEquipe = equipeId ? { equipeId } : {};
  const { quadrimestre, ano } = quadrimestreAtual();

  const tipos: TipoEquipe[] = ["ESF", "EAP", "EMULTI", "ESB"];

  return Promise.all(
    tipos.map(async (tipo) => {
      const whereEquipe = { tipo, ...(equipeId ? { id: equipeId } : {}) };

      const [cadastrosIndividuais, visitasAcs, atendimentos, resultados] = await Promise.all([
        prisma.cadastroIndividual.count({ where: { equipe: whereEquipe, ...filtroEquipe } }),
        prisma.cadastroDomiciliar.count({
          where: { equipe: whereEquipe, ...filtroEquipe, profissional: { ehAcs: true } },
        }),
        prisma.atendimento.count({ where: { equipe: whereEquipe, ...filtroEquipe } }),
        prisma.resultadoIndicador.findMany({
          where: { equipe: whereEquipe, quadrimestre, ano },
          select: { valorCalculado: true },
        }),
      ]);

      const percentualMetaAtingida =
        resultados.length > 0
          ? Math.round(
              (resultados.reduce((soma, r) => soma + Number(r.valorCalculado), 0) / resultados.length) * 100,
            ) / 100
          : null;

      return { tipo, cadastrosIndividuais, visitasAcs, atendimentos, percentualMetaAtingida };
    }),
  );
}
