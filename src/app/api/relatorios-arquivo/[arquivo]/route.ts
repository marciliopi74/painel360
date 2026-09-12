import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const RELATORIOS_DIR = process.env.RELATORIOS_DIR ?? join(process.cwd(), "relatorios-gerados");

// Nomes são sempre gerados por src/lib/relatorios.ts no formato
// "<tipo>-<periodo>-<uuid>.html" — qualquer coisa fora desse formato é rejeitada, o que evita
// tanto path traversal quanto o alerta do Turbopack sobre acesso dinâmico ao filesystem.
const NOME_ARQUIVO_VALIDO = /^[a-z0-9][a-z0-9._-]*\.html$/i;

export async function GET(_req: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { arquivo } = await params;
  if (!NOME_ARQUIVO_VALIDO.test(arquivo)) {
    return NextResponse.json({ erro: "Nome de arquivo inválido" }, { status: 400 });
  }

  try {
    const conteudo = await readFile(join(/* turbopackIgnore: true */ RELATORIOS_DIR, arquivo), "utf-8");
    return new NextResponse(conteudo, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch {
    return NextResponse.json({ erro: "Relatório não encontrado" }, { status: 404 });
  }
}
