import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const sincronizacao = await prisma.sincronizacao.findUnique({ where: { id } });
  if (!sincronizacao) return NextResponse.json({ erro: "Não encontrada" }, { status: 404 });

  return NextResponse.json(sincronizacao);
}
