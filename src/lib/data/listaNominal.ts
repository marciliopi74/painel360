import { Prisma, type Quadrimestre } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";
import { intervaloQuadrimestre } from "@/lib/data/periodo";

export const CODIGOS_LISTA_NOMINAL = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"] as const;
export type CodigoListaNominal = (typeof CODIGOS_LISTA_NOMINAL)[number];

export type CriterioNominal = { codigo: string; descricao: string };

type CabecalhoPessoa = {
  cidadaoCns: string;
  nome: string;
  identificador: string;
  usaCpf: boolean;
  dataNascimento: Date | null;
  dataUltimoAtendimento: Date | null;
  microarea: string | null;
  equipeNome: string;
};

export type LinhaBoaPratica = CabecalhoPessoa & {
  atingidas: CriterioNominal[];
  naoAtingidas: CriterioNominal[];
};

export type LinhaC1 = CabecalhoPessoa & {
  consultaProgramada: boolean;
  tipoAtendimento: string;
};

// Resolve CPF/nascimento/microárea (esus.tb_cidadao) e a data do atendimento mais recente
// (esus.tb_fat_atendimento_individual, sem filtro de CBO/tipo — é só "quando essa pessoa foi
// vista pela última vez", não faz parte do cálculo de nenhum indicador) para um lote de CNS já
// resolvidos localmente. "Identificador" prioriza CPF (o que o usuário pediu: "por CPF ou Cartão
// SUS") e cai pro CNS quando a pessoa não tem CPF cadastrado no e-SUS.
type DetalhesPessoa = { nome: string; cpf: string | null; dataNascimento: Date | null; dataUltimoAtendimento: Date | null; microarea: string | null };

async function buscarCabecalhoPessoas(cnsList: string[]): Promise<Map<string, DetalhesPessoa>> {
  if (cnsList.length === 0) return new Map();

  const linhas = await prisma.$queryRaw<
    { cns: string; nome: string | null; cpf: string | null; nascimento: Date | null; microarea: string | null; ultimo_atendimento: Date | null }[]
  >`
    SELECT
      c.nu_cns AS cns,
      COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome,
      c.nu_cpf AS cpf,
      c.dt_nascimento AS nascimento,
      c.nu_micro_area AS microarea,
      (SELECT max(f.dt_inicial_atendimento)::date FROM esus.tb_fat_atendimento_individual f WHERE f.co_fat_cidadao_pec = c.co_seq_cidadao) AS ultimo_atendimento
    FROM esus.tb_cidadao c
    WHERE c.nu_cns = ANY(${cnsList}::text[])
  `;

  return new Map(
    linhas.map((l) => [
      l.cns,
      { nome: l.nome ?? "Nome não informado", dataNascimento: l.nascimento, dataUltimoAtendimento: l.ultimo_atendimento, microarea: l.microarea, cpf: l.cpf },
    ]),
  );
}

function montarIdentificador(cns: string, cpf: string | null | undefined): { identificador: string; usaCpf: boolean } {
  return cpf ? { identificador: cpf, usaCpf: true } : { identificador: cns, usaCpf: false };
}

// requisito do usuário (2026-09-13): lista nominal por indicador (C2-C7 — os que têm boas
// práticas/critérios individuais, ver categoria "boa_pratica_pontuada" em IndicadorCatalogo),
// organizada por CPF/CNS, com nascimento, último atendimento, microárea, equipe e quais boas
// práticas foram atingidas/não atingidas no quadrimestre. Reaproveita a mesma tabela
// (boas_praticas_pontuacao_pessoa) já usada pelo drill-down de /indicadores-qualidade e pela
// tela de Detalhe do Cidadão (listarCriteriosPrevine em src/lib/data/cidadao.ts) — aqui agregada
// por pessoa em vez de por critério.
export async function listarListaNominalBoaPratica(
  usuario: UsuarioSessao,
  codigo: Exclude<CodigoListaNominal, "C1">,
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<LinhaBoaPratica[]> {
  const equipeId = await equipeIdPermitido(usuario);

  const indicador = await prisma.indicadorCatalogo.findUnique({ where: { codigo }, select: { id: true } });
  if (!indicador) return [];

  const pontuacoes = await prisma.boaPraticaPontuacaoPessoa.findMany({
    where: { indicadorId: indicador.id, quadrimestre, ano, ...(equipeId ? { equipeId } : {}) },
    include: { criterio: true, equipe: { select: { nome: true } } },
    orderBy: [{ cidadaoCns: "asc" }, { criterio: { codigoCriterio: "asc" } }],
  });
  if (pontuacoes.length === 0) return [];

  const porPessoa = new Map<string, { equipeNome: string; atingidas: CriterioNominal[]; naoAtingidas: CriterioNominal[] }>();
  for (const p of pontuacoes) {
    const entrada = porPessoa.get(p.cidadaoCns) ?? { equipeNome: p.equipe.nome, atingidas: [], naoAtingidas: [] };
    const criterio = { codigo: p.criterio.codigoCriterio, descricao: p.criterio.descricao };
    (p.atingiu ? entrada.atingidas : entrada.naoAtingidas).push(criterio);
    porPessoa.set(p.cidadaoCns, entrada);
  }

  const cabecalhos = await buscarCabecalhoPessoas([...porPessoa.keys()]);

  const linhas: LinhaBoaPratica[] = [...porPessoa.entries()].map(([cns, dados]) => {
    const cab = cabecalhos.get(cns);
    return {
      cidadaoCns: cns,
      nome: cab?.nome ?? "Nome não informado",
      ...montarIdentificador(cns, cab?.cpf),
      dataNascimento: cab?.dataNascimento ?? null,
      dataUltimoAtendimento: cab?.dataUltimoAtendimento ?? null,
      microarea: cab?.microarea ?? null,
      equipeNome: dados.equipeNome,
      atingidas: dados.atingidas,
      naoAtingidas: dados.naoAtingidas,
    };
  });

  return linhas.sort((a, b) => a.identificador.localeCompare(b.identificador));
}

// C1 não tem critérios/boas práticas próprios no catálogo (é "indicador_proporcional": nº de
// atendimentos por demanda programada ÷ nº total de atendimentos elegíveis — ver calcular_c1 em
// sql/04_indicadores_motor_calculo.sql), então não existe uma pessoa "elegível" registrada em
// boas_praticas_pontuacao_pessoa para reaproveitar aqui. A tabela local `atendimentos` (já filtrada
// certo por CBO/tipo/equipe na sincronização) também não guarda o cidadão do atendimento — só o
// fato do e-SUS via FDW sabe disso (co_fat_cidadao_pec). Por isso: primeiro repete EXATAMENTE os
// mesmos filtros de calcular_c1 sobre a tabela local `atendimentos` (mesmos arrays de CBO/tipo —
// mantidos em sincronia manual com aquela procedure), depois resolve o cidadão de cada atendimento
// já elegível via FDW só para exibição. Pega o atendimento mais recente de cada pessoa no período
// ("até aquele último atendimento") para decidir se contou como demanda programada.
const C1_CBO = ["225142", "225170", "225130", "225125", "225250", "223565", "223505"];
const C1_TIPOS_ELEGIVEIS = [
  "Consulta agendada programada / Cuidado continuado",
  "Consulta agendada",
  "Escuta inicial / Orientação",
  "Consulta no dia",
  "Atendimento de urgência",
];
const C1_TIPOS_PROGRAMADA = ["Consulta agendada programada / Cuidado continuado", "Consulta agendada"];

export async function listarListaNominalC1(usuario: UsuarioSessao, quadrimestre: Quadrimestre, ano: number): Promise<LinhaC1[]> {
  const equipeId = await equipeIdPermitido(usuario);
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);

  // equipeIdPermitido() devolve null (sem restrição), um uuid real, ou o sentinela
  // "__nenhuma__" (profissional sem equipe vinculada — não deve ver nada). Esse sentinela não é
  // um uuid válido, então nunca pode ir para um `::uuid` direto (estouraria "invalid input
  // syntax for type uuid" em vez de simplesmente não retornar linhas).
  const condicaoEquipe = equipeId === null ? Prisma.empty : equipeId === "__nenhuma__" ? Prisma.sql`AND false` : Prisma.sql`AND a.equipe_id = ${equipeId}::uuid`;

  const linhas = await prisma.$queryRaw<
    {
      cns: string;
      nome: string | null;
      cpf: string | null;
      nascimento: Date | null;
      microarea: string | null;
      equipe_nome: string;
      data_atendimento: Date;
      tipo_atendimento: string;
    }[]
  >`
    SELECT DISTINCT ON (c.nu_cns)
      c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
      c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
      eq.nome AS equipe_nome, a.data_atendimento, a.tipo_atendimento
    FROM atendimentos a
    JOIN equipes eq ON eq.id = a.equipe_id
    JOIN esus.tb_fat_atendimento_individual f ON f.co_seq_fat_atd_ind = a.fonte_id
    JOIN esus.tb_cidadao c ON c.co_seq_cidadao = f.co_fat_cidadao_pec
    WHERE eq.tipo IN ('ESF', 'EAP')
      AND a.data_atendimento BETWEEN ${inicio} AND ${fim}
      AND cbo_no_grupo(a.cbo, ${C1_CBO}::text[])
      AND a.tipo_atendimento = ANY(${C1_TIPOS_ELEGIVEIS}::text[])
      ${condicaoEquipe}
    ORDER BY c.nu_cns, a.data_atendimento DESC
  `;

  return linhas
    .map((l) => ({
      cidadaoCns: l.cns,
      nome: l.nome ?? "Nome não informado",
      ...montarIdentificador(l.cns, l.cpf),
      dataNascimento: l.nascimento,
      dataUltimoAtendimento: l.data_atendimento,
      microarea: l.microarea,
      equipeNome: l.equipe_nome,
      consultaProgramada: C1_TIPOS_PROGRAMADA.includes(l.tipo_atendimento),
      tipoAtendimento: l.tipo_atendimento,
    }))
    .sort((a, b) => a.identificador.localeCompare(b.identificador));
}

export async function listarListaNominal(
  usuario: UsuarioSessao,
  codigo: CodigoListaNominal,
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<{ tipo: "c1"; linhas: LinhaC1[] } | { tipo: "boa_pratica"; linhas: LinhaBoaPratica[] }> {
  if (codigo === "C1") return { tipo: "c1", linhas: await listarListaNominalC1(usuario, quadrimestre, ano) };
  return { tipo: "boa_pratica", linhas: await listarListaNominalBoaPratica(usuario, codigo, quadrimestre, ano) };
}

// ============================================================================================
// Lista nominal para a tela de Indicadores de Qualidade (2026-09-13) — botão "Ver lista nominal"
// em TODOS os 15 indicadores (C1-C7, B1-B6, M1-M2), não só os "boa_pratica_pontuada" (C2-C7).
// Diferente das funções acima (escopadas por usuário/RBAC, usadas pela tela de Atendimentos),
// estas recebem `equipeIds` já resolvido pela própria página de Indicadores de Qualidade,
// porque ali o escopo é "equipes do eixo selecionado" (+ filtro opcional de uma equipe
// específica), não só RBAC — substituem o antigo listarDrillDownIndicador (removido de
// src/lib/data/indicadores.ts por ficar sem nenhum uso depois desta troca). Mantidas separadas
// das funções de cima de propósito, para não arriscar regressão na tela de Atendimentos (já em
// produção) só para eliminar uma duplicação pequena.
//
// Estrutura real de cada indicador (conferida em sql/09_indicadores_b1_b6.sql e
// sql/10_indicadores_m1_m2.sql antes de implementar, não fabricada):
//  - C1, B1, B2, B4: população de pessoas elegíveis clara + um evento único que decide se
//    contam pro numerador — mesmo formato "pessoa_evento" já usado pelo C1 acima.
//  - B3, B5, B6: numerador/denominador são contagens de PROCEDIMENTOS (não de pessoas
//    distintas — a mesma pessoa pode ter vários procedimentos contados). Não existe "atingiu/
//    não atingiu" nesse sentido, então a lista aqui é um LOG de eventos: cada procedimento
//    contado, com o paciente e se ele também contou pro numerador.
//  - M1, M2: numerador conta EVENTOS (atendimentos/ações), não pessoas distintas — mesma lógica
//    de log de eventos. M2 tem uma particularidade real: "atividade coletiva" é contada por
//    SESSÃO no denominador (não por participante), e essas sessões não têm um paciente único
//    associado — aparecem na lista com paciente "—".

export type LinhaPessoaEvento = CabecalhoPessoa & { atingiu: boolean; rotuloEvento: string };

export type LinhaEvento = {
  cidadaoCns: string | null;
  nome: string;
  identificador: string | null;
  usaCpf: boolean;
  dataNascimento: Date | null;
  microarea: string | null;
  equipeNome: string;
  dataEvento: Date;
  descricaoEvento: string;
  contaNumerador: boolean;
};

export type ResultadoListaNominalIndicador =
  | { tipo: "boa_pratica"; linhas: LinhaBoaPratica[] }
  | { tipo: "pessoa_evento"; linhas: LinhaPessoaEvento[] }
  | { tipo: "evento"; linhas: LinhaEvento[] };

async function listarListaNominalBoaPraticaPorEquipes(
  indicadorId: string,
  equipeIds: string[],
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<LinhaBoaPratica[]> {
  if (equipeIds.length === 0) return [];

  const pontuacoes = await prisma.boaPraticaPontuacaoPessoa.findMany({
    where: { indicadorId, quadrimestre, ano, equipeId: { in: equipeIds } },
    include: { criterio: true, equipe: { select: { nome: true } } },
    orderBy: [{ cidadaoCns: "asc" }, { criterio: { codigoCriterio: "asc" } }],
  });
  if (pontuacoes.length === 0) return [];

  const porPessoa = new Map<string, { equipeNome: string; atingidas: CriterioNominal[]; naoAtingidas: CriterioNominal[] }>();
  for (const p of pontuacoes) {
    const entrada = porPessoa.get(p.cidadaoCns) ?? { equipeNome: p.equipe.nome, atingidas: [], naoAtingidas: [] };
    const criterio = { codigo: p.criterio.codigoCriterio, descricao: p.criterio.descricao };
    (p.atingiu ? entrada.atingidas : entrada.naoAtingidas).push(criterio);
    porPessoa.set(p.cidadaoCns, entrada);
  }

  const cabecalhos = await buscarCabecalhoPessoas([...porPessoa.keys()]);

  const linhas: LinhaBoaPratica[] = [...porPessoa.entries()].map(([cns, dados]) => {
    const cab = cabecalhos.get(cns);
    return {
      cidadaoCns: cns,
      nome: cab?.nome ?? "Nome não informado",
      ...montarIdentificador(cns, cab?.cpf),
      dataNascimento: cab?.dataNascimento ?? null,
      dataUltimoAtendimento: cab?.dataUltimoAtendimento ?? null,
      microarea: cab?.microarea ?? null,
      equipeNome: dados.equipeNome,
      atingidas: dados.atingidas,
      naoAtingidas: dados.naoAtingidas,
    };
  });

  return linhas.sort((a, b) => a.identificador.localeCompare(b.identificador));
}

async function listarListaNominalC1PorEquipes(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaPessoaEvento[]> {
  if (equipeIds.length === 0) return [];
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);

  const linhas = await prisma.$queryRaw<
    {
      cns: string;
      nome: string | null;
      cpf: string | null;
      nascimento: Date | null;
      microarea: string | null;
      equipe_nome: string;
      data_atendimento: Date;
      tipo_atendimento: string;
    }[]
  >`
    SELECT DISTINCT ON (c.nu_cns)
      c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
      c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
      eq.nome AS equipe_nome, a.data_atendimento, a.tipo_atendimento
    FROM atendimentos a
    JOIN equipes eq ON eq.id = a.equipe_id
    JOIN esus.tb_fat_atendimento_individual f ON f.co_seq_fat_atd_ind = a.fonte_id
    JOIN esus.tb_cidadao c ON c.co_seq_cidadao = f.co_fat_cidadao_pec
    WHERE eq.id = ANY(${equipeIds}::uuid[])
      AND eq.tipo IN ('ESF', 'EAP')
      AND a.data_atendimento BETWEEN ${inicio} AND ${fim}
      AND cbo_no_grupo(a.cbo, ${C1_CBO}::text[])
      AND a.tipo_atendimento = ANY(${C1_TIPOS_ELEGIVEIS}::text[])
    ORDER BY c.nu_cns, a.data_atendimento DESC
  `;

  return linhas
    .map((l) => ({
      cidadaoCns: l.cns,
      nome: l.nome ?? "Nome não informado",
      ...montarIdentificador(l.cns, l.cpf),
      dataNascimento: l.nascimento,
      dataUltimoAtendimento: l.data_atendimento,
      microarea: l.microarea,
      equipeNome: l.equipe_nome,
      atingiu: C1_TIPOS_PROGRAMADA.includes(l.tipo_atendimento),
      rotuloEvento: l.tipo_atendimento,
    }))
    .sort((a, b) => a.identificador.localeCompare(b.identificador));
}

// B1/B4 usam a população vinculada à equipe de REFERÊNCIA (ESF/EAP), não à própria eSB — ver
// nota 3 em sql/09_indicadores_b1_b6.sql (regra de vinculação eSB↔eSF/eAP).
async function buscarEquipesEsbComReferencia(equipeIds: string[]): Promise<{ id: string; nome: string; ine: string; equipeReferenciaId: string }[]> {
  const equipes = await prisma.equipe.findMany({
    where: { id: { in: equipeIds }, tipo: "ESB", ativo: true, ine: { not: null }, equipeReferenciaId: { not: null } },
    select: { id: true, nome: true, ine: true, equipeReferenciaId: true },
  });
  return equipes as { id: string; nome: string; ine: string; equipeReferenciaId: string }[];
}

async function buscarEquipesEsb(equipeIds: string[]): Promise<{ id: string; nome: string; ine: string }[]> {
  const equipes = await prisma.equipe.findMany({
    where: { id: { in: equipeIds }, tipo: "ESB", ativo: true, ine: { not: null } },
    select: { id: true, nome: true, ine: true },
  });
  return equipes as { id: string; nome: string; ine: string }[];
}

const B1_CBO = ["223208", "223293", "223272"];

// ===================== B1: Primeira consulta odontológica programada =====================
async function listarListaNominalB1(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaPessoaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEsb = await buscarEquipesEsbComReferencia(equipeIds);
  if (equipesEsb.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEsb.map(async (esb) => {
      const linhas = await prisma.$queryRaw<
        { cns: string; nome: string | null; cpf: string | null; nascimento: Date | null; microarea: string | null; data_evento: Date | null }[]
      >`
        SELECT
          p.cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
          p.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
          (SELECT max(o.dt_inicial_atendimento)::date
           FROM esus.tb_fat_atendimento_odonto o
           JOIN esus.tb_dim_tipo_consulta_odonto tc ON tc.co_seq_dim_tipo_cnsulta_odonto = o.co_dim_tipo_consulta
           JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = o.co_dim_equipe_1
           WHERE dim_eq.nu_ine = ${esb.ine}
             AND o.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
             AND cbo_no_grupo(nu_cbo_de(o.co_dim_cbo_1), ${B1_CBO}::text[])
             AND tc.ds_tipo_consulta_odonto ILIKE '%primeira consulta%program%'
             AND o.co_fat_cidadao_pec = p.co_cidadao
          ) AS data_evento
        FROM cidadaos_vinculados_equipe(${esb.equipeReferenciaId}::uuid) p
        JOIN esus.tb_cidadao c ON c.co_seq_cidadao = p.co_cidadao
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? "Nome não informado",
        ...montarIdentificador(l.cns, l.cpf),
        dataNascimento: l.nascimento,
        dataUltimoAtendimento: l.data_evento,
        microarea: l.microarea,
        equipeNome: esb.nome,
        atingiu: l.data_evento !== null,
        rotuloEvento: "Primeira consulta odontológica programada",
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => a.identificador.localeCompare(b.identificador));
}

const B2_CBO = ["223208", "223293", "223272"];

// ===================== B2: Tratamento odontológico concluído =====================
async function listarListaNominalB2(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaPessoaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEsb = await buscarEquipesEsb(equipeIds);
  if (equipesEsb.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEsb.map(async (esb) => {
      const linhas = await prisma.$queryRaw<
        {
          cns: string;
          nome: string | null;
          cpf: string | null;
          nascimento: Date | null;
          microarea: string | null;
          concluiu: boolean;
          data_conclusao: Date | null;
          data_ultimo: Date | null;
        }[]
      >`
        SELECT
          c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
          c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
          bool_or(coalesce(o.st_conduta_tratamento_concluid, 0) = 1) AS concluiu,
          max(o.dt_inicial_atendimento::date) FILTER (WHERE coalesce(o.st_conduta_tratamento_concluid, 0) = 1) AS data_conclusao,
          max(o.dt_inicial_atendimento::date) AS data_ultimo
        FROM esus.tb_fat_atendimento_odonto o
        JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = o.co_dim_equipe_1
        JOIN esus.tb_cidadao c ON c.co_seq_cidadao = o.co_fat_cidadao_pec
        WHERE dim_eq.nu_ine = ${esb.ine}
          AND o.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
          AND cbo_no_grupo(nu_cbo_de(o.co_dim_cbo_1), ${B2_CBO}::text[])
          AND o.co_fat_cidadao_pec IN (
            SELECT o2.co_fat_cidadao_pec
            FROM esus.tb_fat_atendimento_odonto o2
            LEFT JOIN esus.tb_dim_tipo_consulta_odonto tc2 ON tc2.co_seq_dim_tipo_cnsulta_odonto = o2.co_dim_tipo_consulta
            JOIN esus.tb_dim_equipe dim_eq2 ON dim_eq2.co_seq_dim_equipe = o2.co_dim_equipe_1
            WHERE dim_eq2.nu_ine = ${esb.ine}
              AND o2.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
              AND cbo_no_grupo(nu_cbo_de(o2.co_dim_cbo_1), ${B2_CBO}::text[])
              AND tc2.ds_tipo_consulta_odonto ILIKE '%primeira consulta%program%'
          )
        GROUP BY c.nu_cns, c.no_social, c.no_cidadao, c.nu_cpf, c.dt_nascimento, c.nu_micro_area
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? "Nome não informado",
        ...montarIdentificador(l.cns, l.cpf),
        dataNascimento: l.nascimento,
        dataUltimoAtendimento: l.data_conclusao ?? l.data_ultimo,
        microarea: l.microarea,
        equipeNome: esb.nome,
        atingiu: l.concluiu,
        rotuloEvento: "Tratamento odontológico concluído",
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => a.identificador.localeCompare(b.identificador));
}

const B4_CBO = ["223208", "223293", "223272", "322405", "322425", "322415", "322430"];
const B4_CODIGO_PROCEDIMENTO = "0101020031";

// ===================== B4: Escovação dental supervisionada (6-12 anos) =====================
async function listarListaNominalB4(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaPessoaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEsb = await buscarEquipesEsbComReferencia(equipeIds);
  if (equipesEsb.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEsb.map(async (esb) => {
      const linhas = await prisma.$queryRaw<
        { cns: string; nome: string | null; cpf: string | null; nascimento: Date | null; microarea: string | null; data_evento: Date | null }[]
      >`
        SELECT
          p.cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
          p.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
          (SELECT max(t.dt_registro)::date
           FROM esus.tb_fat_atvdd_coletiva_part part
           JOIN esus.tb_fat_atividade_coletiva ativ ON ativ.co_seq_fat_atividade_coletiva = part.co_fat_atividade_coletiva
           LEFT JOIN esus.tb_dim_procedimento dp ON dp.co_seq_dim_procedimento = ativ.co_dim_procedimento
           JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
           JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = part.co_dim_equipe
           WHERE dim_eq.nu_ine = ${esb.ine}
             AND t.dt_registro BETWEEN ${inicio} AND ${fim}
             AND cbo_no_grupo(nu_cbo_de(part.co_dim_cbo), ${B4_CBO}::text[])
             AND (dp.co_proced = ${B4_CODIGO_PROCEDIMENTO} OR ativ.ds_filtro_pratica_em_saude ILIKE '%escova%supervision%')
             AND part.co_fat_cidadao_pec = p.co_cidadao
          ) AS data_evento
        FROM cidadaos_vinculados_equipe(${esb.equipeReferenciaId}::uuid) p
        JOIN esus.tb_cidadao c ON c.co_seq_cidadao = p.co_cidadao
        WHERE p.dt_nascimento IS NOT NULL AND extract(year FROM age(${fim}::date, p.dt_nascimento)) BETWEEN 6 AND 12
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? "Nome não informado",
        ...montarIdentificador(l.cns, l.cpf),
        dataNascimento: l.nascimento,
        dataUltimoAtendimento: l.data_evento,
        microarea: l.microarea,
        equipeNome: esb.nome,
        atingiu: l.data_evento !== null,
        rotuloEvento: "Escovação dental supervisionada",
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => a.identificador.localeCompare(b.identificador));
}

// ===================== B3/B5/B6: procedimentos odontológicos (log de eventos) =====================
// Numerador e denominador dos 3 são contagens de PROCEDIMENTOS (tb_fat_atend_odonto_proced),
// não de pessoas distintas — a mesma pessoa pode entrar várias vezes. Códigos copiados
// literalmente de calcular_b3/b5/b6 em sql/09_indicadores_b1_b6.sql.
async function listarListaNominalProcedimentosOdonto(
  equipeIds: string[],
  quadrimestre: Quadrimestre,
  ano: number,
  cbo: string[],
  codigosTotal: string[],
  codigosNumerador: string[],
): Promise<LinhaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEsb = await buscarEquipesEsb(equipeIds);
  if (equipesEsb.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEsb.map(async (esb) => {
      const linhas = await prisma.$queryRaw<
        {
          cns: string | null;
          nome: string | null;
          cpf: string | null;
          nascimento: Date | null;
          microarea: string | null;
          data_evento: Date;
          descricao: string | null;
          codigo: string;
          conta_numerador: boolean;
        }[]
      >`
        SELECT
          c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
          c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
          pr.dt_inicial_atendimento::date AS data_evento,
          dp.ds_proced AS descricao, dp.co_proced AS codigo,
          (dp.co_proced = ANY(${codigosNumerador}::text[])) AS conta_numerador
        FROM esus.tb_fat_atend_odonto_proced pr
        JOIN esus.tb_dim_procedimento dp ON dp.co_seq_dim_procedimento = pr.co_dim_procedimento
        JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = pr.co_dim_equipe_1
        LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = pr.co_fat_cidadao_pec
        WHERE dim_eq.nu_ine = ${esb.ine}
          AND pr.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
          AND cbo_no_grupo(nu_cbo_de(pr.co_dim_cbo_1), ${cbo}::text[])
          AND dp.co_proced = ANY(${codigosTotal}::text[])
        ORDER BY pr.dt_inicial_atendimento DESC
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? (l.cns ? "Nome não informado" : "Paciente não identificado"),
        ...(l.cns ? montarIdentificador(l.cns, l.cpf) : { identificador: null, usaCpf: false }),
        dataNascimento: l.nascimento,
        microarea: l.microarea,
        equipeNome: esb.nome,
        dataEvento: l.data_evento,
        descricaoEvento: l.descricao ?? l.codigo,
        contaNumerador: l.conta_numerador,
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => b.dataEvento.getTime() - a.dataEvento.getTime());
}

const B3_CBO = ["223208", "223293", "223272", "322405", "322425"];
const B3_CODIGOS_EXODONTIA = ["0414020138", "0414020146"];
const B3_CODIGOS_TOTAL = [
  "0101020058", "0101020066", "0101020074", "0101020082", "0101020090", "0101020120",
  "0307010015", "0307010031", "0307010066", "0307010074", "0307010082", "0307010104", "0307010112", "0307010120",
  "0307020010", "0307020029",
  "0307030024", "0307030040", "0307030059", "0307030067", "0307030075", "0307030083",
  "0307050017", "0414020138", "0414020146",
];

const B5_CBO = ["223208", "223293", "223272", "322405", "322425"];
const B5_CODIGOS_PREVENTIVOS = ["0101020058", "0101020066", "0101020074", "0101020082", "0101020104", "0101020120", "0307030040"];
const B5_CODIGOS_TOTAL = [
  "0101020058", "0101020066", "0101020074", "0101020082", "0101020090", "0101020104", "0101020120",
  "0414020138",
  "0307010015", "0307010031", "0307010066", "0307010074", "0307010082", "0307010104", "0307010112", "0307010120", "0307010147", "0307010155",
  "0307020010", "0307020029", "0307020070",
  "0307030024", "0307030040", "0307030059", "0307030067", "0307030075", "0307030083", "0307050017",
];

const B6_CBO = ["223208", "223293", "223272"];
const B6_CODIGO_ART = ["0307010074"];
const B6_CODIGOS_RESTAURADORES = ["0307010074", "0307010031", "0307010082", "0307010104", "0307010112", "0307010120"];

async function buscarEquipesEmulti(equipeIds: string[]): Promise<{ id: string; nome: string; ine: string }[]> {
  const equipes = await prisma.equipe.findMany({
    where: { id: { in: equipeIds }, tipo: "EMULTI", ativo: true, ine: { not: null } },
    select: { id: true, nome: true, ine: true },
  });
  return equipes as { id: string; nome: string; ine: string }[];
}

// ===================== M1: Média de atendimentos por pessoa (log de eventos) =====================
// Numerador = soma bruta de atendimentos individuais + participações em atividade coletiva
// (não pessoas distintas — cada linha aqui é +1 no numerador real de M1).
async function listarListaNominalM1(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEmulti = await buscarEquipesEmulti(equipeIds);
  if (equipesEmulti.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEmulti.map(async (eq) => {
      const linhas = await prisma.$queryRaw<
        { cns: string | null; nome: string | null; cpf: string | null; nascimento: Date | null; microarea: string | null; data_evento: Date; descricao: string }[]
      >`
        (SELECT c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
                c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
                f.dt_inicial_atendimento::date AS data_evento, 'Atendimento individual' AS descricao
         FROM esus.tb_fat_atendimento_individual f
         JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
         LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = f.co_fat_cidadao_pec
         WHERE dim_eq.nu_ine = ${eq.ine}
           AND f.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
           AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), cbo_emulti()))
        UNION ALL
        (SELECT c.nu_cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao), c.nu_cpf,
                c.dt_nascimento, c.nu_micro_area,
                t.dt_registro::date, 'Atividade coletiva'
         FROM esus.tb_fat_atvdd_coletiva_part part
         JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = part.co_dim_tempo
         JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = part.co_dim_equipe
         LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = part.co_fat_cidadao_pec
         WHERE dim_eq.nu_ine = ${eq.ine}
           AND t.dt_registro BETWEEN ${inicio} AND ${fim}
           AND cbo_no_grupo(nu_cbo_de(part.co_dim_cbo), cbo_emulti()))
        ORDER BY data_evento DESC
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? (l.cns ? "Nome não informado" : "Paciente não identificado"),
        ...(l.cns ? montarIdentificador(l.cns, l.cpf) : { identificador: null, usaCpf: false }),
        dataNascimento: l.nascimento,
        microarea: l.microarea,
        equipeNome: eq.nome,
        dataEvento: l.data_evento,
        descricaoEvento: l.descricao,
        contaNumerador: true,
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => b.dataEvento.getTime() - a.dataEvento.getTime());
}

// ===================== M2: Ações interprofissionais (log de eventos) =====================
// 3 fontes heterogêneas somadas no denominador real (ver sql/10_indicadores_m1_m2.sql):
// atendimento individual, cuidado compartilhado (sempre conta no numerador) e atividade
// coletiva — esta última contada por SESSÃO, não por participante, então não tem um paciente
// único (aparece como "—" na lista, com o tema da atividade em vez de um nome).
async function listarListaNominalM2(equipeIds: string[], quadrimestre: Quadrimestre, ano: number): Promise<LinhaEvento[]> {
  const { inicio, fim } = intervaloQuadrimestre(quadrimestre, ano);
  const equipesEmulti = await buscarEquipesEmulti(equipeIds);
  if (equipesEmulti.length === 0) return [];

  const porEquipe = await Promise.all(
    equipesEmulti.map(async (eq) => {
      const linhas = await prisma.$queryRaw<
        {
          cns: string | null;
          nome: string | null;
          cpf: string | null;
          nascimento: Date | null;
          microarea: string | null;
          data_evento: Date;
          descricao: string;
          conta_numerador: boolean;
        }[]
      >`
        (SELECT c.nu_cns AS cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao) AS nome, c.nu_cpf AS cpf,
                c.dt_nascimento AS nascimento, c.nu_micro_area AS microarea,
                f.dt_inicial_atendimento::date AS data_evento, 'Atendimento individual' AS descricao,
                (f.co_dim_profissional_2 IS NOT NULL AND (cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), cbo_emulti()) OR cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_2), cbo_emulti()))) AS conta_numerador
         FROM esus.tb_fat_atendimento_individual f
         JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = f.co_dim_equipe_1
         LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = f.co_fat_cidadao_pec
         WHERE dim_eq.nu_ine = ${eq.ine}
           AND f.dt_inicial_atendimento::date BETWEEN ${inicio} AND ${fim}
           AND cbo_no_grupo(nu_cbo_de(f.co_dim_cbo_1), cbo_emulti()))
        UNION ALL
        (SELECT c.nu_cns, COALESCE(NULLIF(c.no_social, ''), c.no_cidadao), c.nu_cpf,
                c.dt_nascimento, c.nu_micro_area,
                cc.dt_evolucao::date, 'Cuidado compartilhado', true
         FROM esus.tb_fat_cuidado_compartilhado cc
         JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = cc.co_dim_equipe_evolucao
         LEFT JOIN esus.tb_cidadao c ON c.co_seq_cidadao = cc.co_fat_cidadao_pec
         WHERE dim_eq.nu_ine = ${eq.ine}
           AND cc.dt_evolucao::date BETWEEN ${inicio} AND ${fim}
           AND cbo_no_grupo(nu_cbo_de(cc.co_dim_cbo_evolucao), cbo_emulti()))
        UNION ALL
        (SELECT NULL::text AS cns,
                COALESCE(NULLIF(ativ.ds_filtro_tema_para_saude, ''), NULLIF(ativ.ds_filtro_pratica_em_saude, ''), 'Atividade coletiva') AS nome,
                NULL::text AS cpf, NULL::date AS nascimento, NULL::text AS microarea,
                t.dt_registro::date AS data_evento, 'Atividade coletiva (sessão)' AS descricao, false AS conta_numerador
         FROM esus.tb_fat_atividade_coletiva ativ
         JOIN esus.tb_dim_equipe dim_eq ON dim_eq.co_seq_dim_equipe = ativ.co_dim_equipe
         JOIN esus.tb_dim_tempo t ON t.co_seq_dim_tempo = ativ.co_dim_tempo
         WHERE dim_eq.nu_ine = ${eq.ine}
           AND t.dt_registro BETWEEN ${inicio} AND ${fim}
           AND cbo_no_grupo(nu_cbo_de(ativ.co_dim_cbo), cbo_emulti()))
        ORDER BY data_evento DESC
      `;
      return linhas.map((l) => ({
        cidadaoCns: l.cns,
        nome: l.nome ?? (l.cns ? "Nome não informado" : "Atividade coletiva (sessão)"),
        ...(l.cns ? montarIdentificador(l.cns, l.cpf) : { identificador: null, usaCpf: false }),
        dataNascimento: l.nascimento,
        microarea: l.microarea,
        equipeNome: eq.nome,
        dataEvento: l.data_evento,
        descricaoEvento: l.descricao,
        contaNumerador: l.conta_numerador,
      }));
    }),
  );

  return porEquipe.flat().sort((a, b) => b.dataEvento.getTime() - a.dataEvento.getTime());
}

export async function listarListaNominalPorIndicador(
  codigo: string,
  indicadorId: string,
  equipeIds: string[],
  quadrimestre: Quadrimestre,
  ano: number,
): Promise<ResultadoListaNominalIndicador | null> {
  switch (codigo) {
    case "C1":
      return { tipo: "pessoa_evento", linhas: await listarListaNominalC1PorEquipes(equipeIds, quadrimestre, ano) };
    case "C2":
    case "C3":
    case "C4":
    case "C5":
    case "C6":
    case "C7":
      return { tipo: "boa_pratica", linhas: await listarListaNominalBoaPraticaPorEquipes(indicadorId, equipeIds, quadrimestre, ano) };
    case "B1":
      return { tipo: "pessoa_evento", linhas: await listarListaNominalB1(equipeIds, quadrimestre, ano) };
    case "B2":
      return { tipo: "pessoa_evento", linhas: await listarListaNominalB2(equipeIds, quadrimestre, ano) };
    case "B3":
      return { tipo: "evento", linhas: await listarListaNominalProcedimentosOdonto(equipeIds, quadrimestre, ano, B3_CBO, B3_CODIGOS_TOTAL, B3_CODIGOS_EXODONTIA) };
    case "B4":
      return { tipo: "pessoa_evento", linhas: await listarListaNominalB4(equipeIds, quadrimestre, ano) };
    case "B5":
      return { tipo: "evento", linhas: await listarListaNominalProcedimentosOdonto(equipeIds, quadrimestre, ano, B5_CBO, B5_CODIGOS_TOTAL, B5_CODIGOS_PREVENTIVOS) };
    case "B6":
      return { tipo: "evento", linhas: await listarListaNominalProcedimentosOdonto(equipeIds, quadrimestre, ano, B6_CBO, B6_CODIGOS_RESTAURADORES, B6_CODIGO_ART) };
    case "M1":
      return { tipo: "evento", linhas: await listarListaNominalM1(equipeIds, quadrimestre, ano) };
    case "M2":
      return { tipo: "evento", linhas: await listarListaNominalM2(equipeIds, quadrimestre, ano) };
    default:
      return null;
  }
}
