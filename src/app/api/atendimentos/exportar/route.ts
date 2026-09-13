import { NextResponse } from "next/server";
import type { Quadrimestre, TipoEquipe } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { intervaloQuadrimestre, quadrimestreAtual } from "@/lib/data/periodo";
import { ROTULO_ERRO } from "@/lib/data/erros";
import type { StatusCadastro } from "@/lib/data/cadastros";

const LIMITE_LINHAS = 5000;

function csvEscape(valor: string): string {
  return `"${valor.replaceAll('"', '""')}"`;
}

// Export interno de produção clínica — NÃO é um arquivo BPA/RAAS oficial (esses layouts exigem
// campos e validações do Ministério da Saúde/SIA-SUS que este projeto não implementa). Serve
// para conferência local, não para envio ao SISAB/DATASUS.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const [anoParam, quadParam] = (url.searchParams.get("periodo") ?? "").split("-");
  const periodo =
    quadParam && ["Q1", "Q2", "Q3"].includes(quadParam) ? { quadrimestre: quadParam as Quadrimestre, ano: Number(anoParam) } : quadrimestreAtual();
  const { inicio, fim } = intervaloQuadrimestre(periodo.quadrimestre, periodo.ano);

  const equipeIdRestrito = await equipeIdPermitido(session.user);
  const equipeIdParam = url.searchParams.get("equipe") || undefined;
  const tipoEquipeParam = (url.searchParams.get("tipo") as TipoEquipe | null) ?? undefined;
  const statusParam = (url.searchParams.get("status") as StatusCadastro | null) ?? undefined;
  const equipeId = equipeIdRestrito || equipeIdParam;

  const registros = await prisma.atendimento.findMany({
    where: {
      dataAtendimento: { gte: inicio, lte: fim },
      ...(equipeId ? { equipeId } : tipoEquipeParam ? { equipe: { tipo: tipoEquipeParam } } : {}),
      ...(statusParam === "com_erro" ? { temErro: true } : statusParam === "sem_erro" ? { temErro: false } : {}),
    },
    include: { equipe: { select: { nome: true, tipo: true } }, profissional: { select: { nome: true } } },
    orderBy: { dataAtendimento: "desc" },
    take: LIMITE_LINHAS,
  });

  const cabecalho = ["Data", "Equipe", "Tipo de Equipe", "CBO", "Profissional", "Tipo de Atendimento", "Situação", "Tipo de Erro"];
  const linhas = [
    cabecalho,
    ...registros.map((a) => [
      a.dataAtendimento.toLocaleDateString("pt-BR"),
      a.equipe.nome,
      a.equipe.tipo,
      a.cbo ?? "",
      a.profissional?.nome ?? "",
      a.tipoAtendimento,
      a.temErro ? "Com pendência" : "Conforme",
      a.tipoErro ? (ROTULO_ERRO[a.tipoErro] ?? a.tipoErro) : "",
    ]),
  ];

  const csv = "﻿" + linhas.map((linha) => linha.map(csvEscape).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="atendimentos_${periodo.ano}_${periodo.quadrimestre}.csv"`,
    },
  });
}
