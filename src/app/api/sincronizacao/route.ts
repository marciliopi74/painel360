import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { podeDispararSincronizacao } from "@/lib/rbac";

// requisito 7: sincronização manual sob demanda, com progresso acompanhável via GET.
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });
  if (!podeDispararSincronizacao(session.user)) {
    return NextResponse.json({ erro: "Sem permissão para disparar sincronização" }, { status: 403 });
  }

  const sincronizacao = await prisma.sincronizacao.create({
    data: { disparadaPor: session.user.id, tipo: "manual", status: "em_andamento" },
  });

  // dispara em segundo plano — o servidor Next.js roda como processo persistente no
  // docker-compose (next start), não como função serverless, então isto continua
  // executando após a resposta ser enviada.
  prisma
    .$executeRawUnsafe(`CALL sincronizar_esus($1::uuid)`, sincronizacao.id)
    .catch((erro) => console.error("Falha na sincronização manual:", erro));

  return NextResponse.json({ id: sincronizacao.id });
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ erro: "Não autenticado" }, { status: 401 });

  const ultimas = await prisma.sincronizacao.findMany({
    orderBy: { iniciadoEm: "desc" },
    take: 10,
    include: { usuario: { select: { nome: true } } },
  });
  return NextResponse.json(ultimas);
}
