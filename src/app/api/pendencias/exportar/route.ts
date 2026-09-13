import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listarPendencias } from "@/lib/data/pendencias";
import { ROTULO_ERRO } from "@/lib/data/erros";
import { formatarDataHora } from "@/lib/ui/data";

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
    tipoErro: url.searchParams.get("tipoErro") ?? undefined,
  };

  const paginas: Awaited<ReturnType<typeof listarPendencias>>["pendencias"][] = [];
  let pagina = 1;
  let total = Infinity;
  while ((pagina - 1) * 10 < Math.min(total, LIMITE_LINHAS)) {
    const resultado = await listarPendencias(session.user, { ...filtros, pagina });
    paginas.push(resultado.pendencias);
    total = resultado.total;
    pagina += 1;
    if (resultado.pendencias.length === 0) break;
  }
  const registros = paginas.flat();

  const cabecalho = ["Origem", "Título", "Identificador", "Tipo de Erro", "Profissional", "Equipe", "Tipo de Equipe", "Atualizado em"];
  const linhas = [
    cabecalho,
    ...registros.map((p) => [
      p.origem,
      p.titulo,
      p.identificador ?? "",
      ROTULO_ERRO[p.tipoErro] ?? p.tipoErro,
      p.profissionalNome ?? "",
      p.equipeNome,
      p.equipeTipo,
      formatarDataHora(p.data),
    ]),
  ];

  const csv = "﻿" + linhas.map((linha) => linha.map(csvEscape).join(";")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pendencias_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
