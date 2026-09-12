import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeGerenciarUsuarios } from "@/lib/rbac";

const criarUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(8),
  telefone: z.string().min(8),
  papel: z.enum(["gestor_local", "secretario", "coordenador", "profissional"]),
  profissionalId: z.string().uuid().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session || !podeGerenciarUsuarios(session.user)) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }
  const usuarios = await prisma.usuario.findMany({
    where: { id: { not: "00000000-0000-0000-0000-000000000001" } },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, telefone: true, papel: true, ativo: true, criadoEm: true },
  });
  return NextResponse.json(usuarios);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !podeGerenciarUsuarios(session.user)) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }

  const corpo = criarUsuarioSchema.safeParse(await req.json());
  if (!corpo.success) {
    return NextResponse.json({ erro: corpo.error.flatten() }, { status: 400 });
  }

  const { senha, ...dados } = corpo.data;
  try {
    const usuario = await prisma.usuario.create({
      data: { ...dados, senhaHash: await bcrypt.hash(senha, 10) },
      select: { id: true, nome: true, email: true, papel: true },
    });
    return NextResponse.json(usuario, { status: 201 });
  } catch {
    return NextResponse.json({ erro: "E-mail já cadastrado" }, { status: 409 });
  }
}
