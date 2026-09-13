import { NextResponse } from "next/server";
import { Client } from "pg";
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
  //
  // sincronizar_esus faz COMMIT interno (progresso incremental), o que o Postgres só permite
  // quando o CALL roda via protocolo simples (uma única mensagem "Query", sem Parse/Bind) — o
  // client do Prisma sempre usa o protocolo estendido, mesmo sem parâmetros, e falha com "invalid
  // transaction termination". Por isso este CALL usa `pg` diretamente (client.query com uma
  // string pura), não o Prisma.
  // sincronizar_esus não tem bloco EXCEPTION próprio (ver comentário em sql/03_sync_functions.sql)
  // — se o CALL lançar, marcamos o erro aqui.
  const clienteSync = new Client({ connectionString: process.env.DATABASE_URL });
  clienteSync
    .connect()
    .then(() => clienteSync.query(`CALL sincronizar_esus('${sincronizacao.id}'::uuid)`))
    .catch(async (erro) => {
      console.error("Falha na sincronização manual:", erro);
      await prisma.sincronizacao.update({
        where: { id: sincronizacao.id },
        data: { status: "erro", erroMensagem: String(erro?.message ?? erro), concluidoEm: new Date() },
      });
    })
    .finally(() => clienteSync.end());

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
