import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeGerenciarUsuarios } from "@/lib/rbac";

const atualizarUsuarioSchema = z.object({
  ativo: z.boolean().optional(),
  papel: z.enum(["gestor_local", "secretario", "coordenador", "profissional"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !podeGerenciarUsuarios(session.user)) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }

  const corpo = atualizarUsuarioSchema.safeParse(await req.json());
  if (!corpo.success) return NextResponse.json({ erro: corpo.error.flatten() }, { status: 400 });

  const { id } = await params;
  const usuario = await prisma.usuario.update({ where: { id }, data: corpo.data });
  return NextResponse.json(usuario);
}
