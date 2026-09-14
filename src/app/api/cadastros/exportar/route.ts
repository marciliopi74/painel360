import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { construirWhereIndividual, construirWhereDomiciliar, ROTULO_ERRO, type StatusCadastro } from "@/lib/data/cadastros";
import { formatarCpf } from "@/lib/ui/cpf";

const LIMITE_LINHAS = 5000;

function csvEscape(valor: string): string {
  return `"${valor.replaceAll('"', '""')}"`;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const url = new URL(req.url);
  const filtros = {
    busca: url.searchParams.get("busca") ?? undefined,
    equipeId: url.searchParams.get("equipe") ?? undefined,
    status: (url.searchParams.get("status") as StatusCadastro | null) ?? undefined,
  };

  const [individuais, domiciliares] = await Promise.all([
    prisma.cadastroIndividual.findMany({
      where: await construirWhereIndividual(session.user, filtros),
      include: { profissional: { select: { nome: true } }, equipe: { select: { nome: true, tipo: true } } },
      orderBy: { atualizadoEm: "desc" },
      take: LIMITE_LINHAS,
    }),
    prisma.cadastroDomiciliar.findMany({
      where: await construirWhereDomiciliar(session.user, filtros),
      include: { profissional: { select: { nome: true } }, equipe: { select: { nome: true, tipo: true } } },
      orderBy: { atualizadoEm: "desc" },
      take: LIMITE_LINHAS,
    }),
  ]);

  const cabecalho = ["Tipo", "Identificação", "ACS", "Equipe", "Tipo de Equipe", "Data de Cadastro", "Situação", "Tipo de Erro"];
  const linhas = [
    cabecalho,
    ...individuais.map((c) => [
      "Cadastro Individual",
      // desde 2026-09-14 um cadastro pode ter só CPF, sem CNS ainda (ver comentário no schema).
      `${c.cidadaoNome ?? "—"} (${c.cidadaoCns ? `CNS ${c.cidadaoCns}` : `CPF ${formatarCpf(c.cidadaoCpf!)}`})`,
      c.profissional.nome,
      c.equipe.nome,
      c.equipe.tipo,
      c.dataCadastro.toLocaleDateString("pt-BR"),
      c.temErro ? "Com pendência" : "Conforme",
      c.tipoErro ? (ROTULO_ERRO[c.tipoErro] ?? c.tipoErro) : "",
    ]),
    ...domiciliares.map((c) => [
      "Cadastro Domiciliar",
      c.enderecoReferencia,
      c.profissional.nome,
      c.equipe.nome,
      c.equipe.tipo,
      c.dataCadastro.toLocaleDateString("pt-BR"),
      c.temErro ? "Com pendência" : "Conforme",
      c.tipoErro ? (ROTULO_ERRO[c.tipoErro] ?? c.tipoErro) : "",
    ]),
  ];

  const csv = "﻿" + linhas.map((linha) => linha.map(csvEscape).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cadastros_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
