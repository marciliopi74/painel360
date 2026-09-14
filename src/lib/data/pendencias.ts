import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { ROTULO_ERRO } from "@/lib/data/erros";

export const ITENS_POR_PAGINA = 10;

export type OrigemPendencia = "individual" | "domiciliar" | "atendimento";

export type Pendencia = {
  origem: OrigemPendencia;
  id: string;
  titulo: string;
  identificador: string | null;
  // que tipo de documento `identificador` contém — decide o rótulo e se aplica máscara de CPF na
  // exibição (PendenciaCard.tsx). null só ocorre pra domiciliar (não é pessoa, sem identificador).
  tipoIdentificador: "cpf" | "cns" | "dnv" | null;
  // valor pra navegar até /cidadao/[x] — CNS (hash) quando existir, senão CPF, senão DNV (a rota
  // aceita os três desde 2026-09-14). Separado de `identificador` porque este último prioriza CPF
  // pra exibição, mas a navegação deve preferir o CNS quando houver mais de um (mesmo valor que
  // Cadastros/Detalhe do Cidadão já usam em todo o resto do app).
  cidadaoCnsLink: string | null;
  tipoErro: string;
  profissionalNome: string | null;
  equipeNome: string;
  equipeTipo: string;
  data: Date;
};

export type FiltrosPendencia = {
  busca?: string;
  equipeId?: string;
  tipoErro?: string;
  pagina?: number;
};

// requisito 11/15: central unificada de pendências — mesmas 3 tabelas com tem_erro=true já
// usadas em Cadastros e Atendimentos, só que combinadas numa lista só (via UNION ALL em SQL,
// já que são 3 modelos Prisma diferentes) para uma visão de auditoria única. Nenhum campo aqui é
// inventado: sem severidade, sem categoria fora dos tipo_erro reais, sem narrativa por pessoa.
async function construirFiltro(usuario: UsuarioSessao, filtros: FiltrosPendencia) {
  const equipeIdRestrito = await equipeIdPermitido(usuario);
  const equipeId = equipeIdRestrito || filtros.equipeId || undefined;

  const condicoes: Prisma.Sql[] = [];
  if (equipeId) condicoes.push(Prisma.sql`equipe_id = ${equipeId}::uuid`);
  if (filtros.tipoErro) condicoes.push(Prisma.sql`tipo_erro = ${filtros.tipoErro}`);
  if (filtros.busca) condicoes.push(Prisma.sql`(titulo ILIKE ${"%" + filtros.busca + "%"} OR identificador ILIKE ${"%" + filtros.busca + "%"})`);

  return condicoes.length > 0 ? Prisma.sql`WHERE ${Prisma.join(condicoes, " AND ")}` : Prisma.empty;
}

// identificador: prioriza documentos "reais" (CPF, depois DNV) sobre Cartão SUS, como pedido pelo
// usuário em 2026-09-13.
//  - individual: cadastros_individuais.cidadao_cns vem de tb_cds_cad_individual.nu_cns_cidadao,
//    que nesta instalação costuma ser um hash de 32 caracteres, NÃO o CNS real de 15 dígitos —
//    mas essa mesma linha do e-SUS tem nu_cpf_cidadao/nu_dnv_cidadao (CPF/DNV de verdade),
//    guardados localmente em cadastros_individuais.cidadao_cpf/cidadao_dnv desde 2026-09-14 (join
//    ao vivo com o FDW aqui não é mais necessário). Sem CPF nem DNV, cai pro cidadao_cns (mesmo
//    valor já exibido em Cadastros/Detalhe do Cidadão em todo o resto do app) —
//    cidadao_cns_link usa CNS > CPF > DNV (o que existir), pois um cadastro pode ter só um dos
//    três e /cidadao/[x] aceita qualquer um.
//  - atendimento: a tabela local não guarda o cidadão do atendimento (só o e-SUS via FDW sabe
//    disso) — antes exibia o CBO do profissional aqui, que não é um identificador de pessoa
//    (bug real corrigido em 2026-09-13). Resolvido via fonte_id = co_seq_fat_atd_ind ->
//    co_fat_cidadao_pec -> tb_cidadao, que aqui SIM tem CPF/CNS reais (não hash; tb_cidadao não
//    tem um DNV equivalente exposto por esse caminho, então esse branch continua só CPF/CNS).
//  - domiciliar: é um domicílio, não uma pessoa — sem identificador, como já era.
const CTE_PENDENCIAS = Prisma.sql`
  WITH pendencias AS (
    SELECT 'individual' AS origem, ci.id, ci.cidadao_nome AS titulo,
           COALESCE(ci.cidadao_cpf, ci.cidadao_dnv, ci.cidadao_cns) AS identificador,
           CASE WHEN ci.cidadao_cpf IS NOT NULL THEN 'cpf' WHEN ci.cidadao_dnv IS NOT NULL THEN 'dnv' WHEN ci.cidadao_cns IS NOT NULL THEN 'cns' END AS tipo_identificador,
           COALESCE(ci.cidadao_cns, ci.cidadao_cpf, ci.cidadao_dnv) AS cidadao_cns_link,
           ci.tipo_erro, p.nome AS profissional_nome, eq.nome AS equipe_nome, eq.tipo::text AS equipe_tipo,
           ci.equipe_id, ci.atualizado_em AS data
    FROM cadastros_individuais ci
    JOIN profissionais p ON p.id = ci.profissional_id
    JOIN equipes eq ON eq.id = ci.equipe_id
    WHERE ci.tem_erro = true

    UNION ALL

    SELECT 'domiciliar', cd.id, cd.endereco_referencia, NULL, NULL, NULL,
           cd.tipo_erro, p.nome, eq.nome, eq.tipo::text,
           cd.equipe_id, cd.atualizado_em
    FROM cadastros_domiciliares cd
    JOIN profissionais p ON p.id = cd.profissional_id
    JOIN equipes eq ON eq.id = cd.equipe_id
    WHERE cd.tem_erro = true

    UNION ALL

    SELECT 'atendimento', a.id, a.tipo_atendimento,
           COALESCE(c.nu_cpf, c.nu_cns), CASE WHEN c.nu_cpf IS NOT NULL THEN 'cpf' WHEN c.nu_cns IS NOT NULL THEN 'cns' END, NULL,
           a.tipo_erro, p.nome, eq.nome, eq.tipo::text,
           a.equipe_id, a.atualizado_em
    FROM atendimentos a
    LEFT JOIN profissionais p ON p.id = a.profissional_id
    JOIN equipes eq ON eq.id = a.equipe_id
    LEFT JOIN esus.tb_fat_atendimento_individual f ON f.co_seq_fat_atd_ind = a.fonte_id
    LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = f.co_fat_cidadao_pec
    WHERE a.tem_erro = true
  )
`;

type LinhaPendencia = {
  origem: OrigemPendencia;
  id: string;
  titulo: string;
  identificador: string | null;
  tipo_identificador: "cpf" | "cns" | "dnv" | null;
  cidadao_cns_link: string | null;
  tipo_erro: string;
  profissional_nome: string | null;
  equipe_nome: string;
  equipe_tipo: string;
  data: Date;
};

export async function listarPendencias(
  usuario: UsuarioSessao,
  filtros: FiltrosPendencia = {},
): Promise<{ pendencias: Pendencia[]; total: number; pagina: number; totalPaginas: number }> {
  const pagina = Math.max(1, filtros.pagina ?? 1);
  const where = await construirFiltro(usuario, filtros);

  const [linhas, contagem] = await Promise.all([
    prisma.$queryRaw<LinhaPendencia[]>`
      ${CTE_PENDENCIAS}
      SELECT * FROM pendencias
      ${where}
      ORDER BY data DESC
      LIMIT ${ITENS_POR_PAGINA} OFFSET ${(pagina - 1) * ITENS_POR_PAGINA}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      ${CTE_PENDENCIAS}
      SELECT count(*)::bigint AS total FROM pendencias
      ${where}
    `,
  ]);

  const total = Number(contagem[0]?.total ?? 0);
  return {
    pendencias: linhas.map((l) => ({
      origem: l.origem,
      id: l.id,
      titulo: l.titulo,
      identificador: l.identificador,
      tipoIdentificador: l.tipo_identificador,
      cidadaoCnsLink: l.cidadao_cns_link,
      tipoErro: l.tipo_erro,
      profissionalNome: l.profissional_nome,
      equipeNome: l.equipe_nome,
      equipeTipo: l.equipe_tipo,
      data: l.data,
    })),
    total,
    pagina,
    totalPaginas: Math.max(1, Math.ceil(total / ITENS_POR_PAGINA)),
  };
}

export type ResumoPendencias = {
  total: number;
  porTipoErro: { tipoErro: string; rotulo: string; contagem: number }[];
};

export async function obterResumoPendencias(usuario: UsuarioSessao, filtros: Pick<FiltrosPendencia, "equipeId"> = {}): Promise<ResumoPendencias> {
  const where = await construirFiltro(usuario, filtros);

  const grupos = await prisma.$queryRaw<{ tipo_erro: string; contagem: bigint }[]>`
    ${CTE_PENDENCIAS}
    SELECT tipo_erro, count(*)::bigint AS contagem FROM pendencias
    ${where}
    GROUP BY tipo_erro
    ORDER BY contagem DESC
  `;

  const porTipoErro = grupos.map((g) => ({ tipoErro: g.tipo_erro, rotulo: ROTULO_ERRO[g.tipo_erro] ?? g.tipo_erro, contagem: Number(g.contagem) }));
  return { total: porTipoErro.reduce((s, g) => s + g.contagem, 0), porTipoErro };
}
