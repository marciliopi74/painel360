import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { podeGerenciarUsuarios } from "@/lib/rbac";
import {
  atualizarPopulacaoMunicipio,
  atualizarSatisfacaoEquipe,
  adicionarBeneficiarioVulneravel,
  removerBeneficiarioVulneravel,
} from "@/lib/data/vinculoAcompanhamento";

const corpoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("populacao"), populacao: z.number().int().positive() }),
  z.object({
    acao: z.literal("satisfacao"),
    equipeId: z.string().uuid(),
    quadrimestre: z.enum(["Q1", "Q2", "Q3"]),
    ano: z.number().int(),
    percentual: z.number().min(0).max(100),
  }),
  z.object({ acao: z.literal("adicionar_beneficiario"), cidadaoCns: z.string().min(1), cidadaoNome: z.string().nullable().optional() }),
  z.object({ acao: z.literal("remover_beneficiario"), id: z.string().uuid() }),
]);

// requisito do usuário (2026-09-13): campos manuais da Nota Técnica 30 (população do
// município, satisfação Meu SUS Digital, beneficiários Bolsa Família/BPC) — mesma permissão
// de "administra configurações do sistema local" já usada em /api/usuarios.
export async function POST(req: Request) {
  const session = await auth();
  if (!session || !podeGerenciarUsuarios(session.user)) {
    return NextResponse.json({ erro: "Sem permissão" }, { status: 403 });
  }

  const corpo = corpoSchema.safeParse(await req.json());
  if (!corpo.success) {
    return NextResponse.json({ erro: corpo.error.flatten() }, { status: 400 });
  }

  const dados = corpo.data;
  if (dados.acao === "populacao") {
    await atualizarPopulacaoMunicipio(dados.populacao);
  } else if (dados.acao === "satisfacao") {
    await atualizarSatisfacaoEquipe(dados.equipeId, dados.quadrimestre, dados.ano, dados.percentual);
  } else if (dados.acao === "adicionar_beneficiario") {
    await adicionarBeneficiarioVulneravel(dados.cidadaoCns.trim(), dados.cidadaoNome?.trim() || null);
  } else {
    await removerBeneficiarioVulneravel(dados.id);
  }

  return NextResponse.json({ ok: true });
}
