import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { podeDispararSincronizacao } from "@/lib/rbac";
import { gerarRelatorioDiario, gerarRelatorioSemanal, gerarAvaliacaoQuadrimestral } from "@/lib/relatorios";
import { quadrimestreAtual } from "@/lib/data/periodo";

const corpoSchema = z.object({
  tipo: z.enum(["diario", "semanal", "quadrimestral"]),
  quadrimestre: z.enum(["Q1", "Q2", "Q3"]).optional(),
  ano: z.number().int().optional(),
});

// Geração sob demanda dos mesmos relatórios que o worker gera automaticamente (scripts/worker.ts)
// — útil para conferir números atualizados sem esperar a próxima janela agendada (diariamente às
// 6h, semanalmente às segundas, quadrimestralmente no 1º dia após o fechamento).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!podeDispararSincronizacao(session.user)) {
    return NextResponse.json({ erro: "Sem permissão para gerar relatórios" }, { status: 403 });
  }

  const corpo = corpoSchema.safeParse(await req.json());
  if (!corpo.success) return NextResponse.json({ erro: corpo.error.flatten() }, { status: 400 });

  try {
    const periodoPadrao = quadrimestreAtual();
    const quadrimestre = corpo.data.quadrimestre ?? periodoPadrao.quadrimestre;
    const ano = corpo.data.ano ?? periodoPadrao.ano;
    const relatorio =
      corpo.data.tipo === "diario"
        ? await gerarRelatorioDiario()
        : corpo.data.tipo === "semanal"
          ? await gerarRelatorioSemanal()
          : await gerarAvaliacaoQuadrimestral(quadrimestre, ano);

    return NextResponse.json({ id: relatorio.id, arquivoUrl: relatorio.arquivoUrl });
  } catch (erro) {
    console.error("Falha ao gerar relatório sob demanda:", erro);
    return NextResponse.json({ erro: "Falha ao gerar relatório" }, { status: 500 });
  }
}
