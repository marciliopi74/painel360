import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
// Import relativo de propósito: este módulo também é carregado via `tsx` pelo worker
// (scripts/worker.ts), que não resolve o path alias `@/` do tsconfig.json.
import { prisma } from "./prisma";
import type { Quadrimestre } from "@prisma/client";

// requisitos 22-23: relatórios automáticos diário/semanal e avaliação quadrimestral.
// Gerados como HTML simples (sem dependência externa) e gravados em disco — ver
// RELATORIOS_DIR (volume docker `relatorios_gerados`), servidos por
// src/app/api/relatorios-arquivo/[arquivo]/route.ts.
export const RELATORIOS_DIR = process.env.RELATORIOS_DIR ?? join(process.cwd(), "relatorios-gerados");

async function salvarRelatorio(tipo: "diario" | "semanal" | "quadrimestral", periodoReferencia: string, html: string) {
  await mkdir(RELATORIOS_DIR, { recursive: true });
  const nomeArquivo = `${tipo}-${periodoReferencia}-${randomUUID()}.html`;
  await writeFile(join(RELATORIOS_DIR, nomeArquivo), html, "utf-8");

  return prisma.relatorioGerado.create({
    data: { tipo, periodoReferencia, arquivoUrl: `/api/relatorios-arquivo/${nomeArquivo}` },
  });
}

function envolverHtml(titulo: string, corpo: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${titulo}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#18181b}
table{border-collapse:collapse;width:100%;margin-top:1rem}
th,td{border:1px solid #e4e4e7;padding:6px 10px;text-align:left;font-size:14px}
th{background:#fafafa}</style></head><body><h1>${titulo}</h1>${corpo}</body></html>`;
}

export async function gerarRelatorioDiario(dataReferencia = new Date()) {
  const inicioDia = new Date(dataReferencia);
  inicioDia.setHours(0, 0, 0, 0);
  const fimDia = new Date(inicioDia);
  fimDia.setDate(fimDia.getDate() + 1);

  const [cadastros, atendimentos, alertasNovos] = await Promise.all([
    prisma.cadastroIndividual.count({ where: { atualizadoEm: { gte: inicioDia, lt: fimDia } } }),
    prisma.atendimento.count({ where: { dataAtendimento: { gte: inicioDia, lt: fimDia } } }),
    prisma.alerta.count({ where: { criadoEm: { gte: inicioDia, lt: fimDia } } }),
  ]);

  const periodo = inicioDia.toISOString().slice(0, 10);
  const html = envolverHtml(
    `Relatório diário — ${periodo}`,
    `<table><tr><th>Cadastros individuais atualizados</th><td>${cadastros}</td></tr>
     <tr><th>Atendimentos no dia</th><td>${atendimentos}</td></tr>
     <tr><th>Alertas novos</th><td>${alertasNovos}</td></tr></table>`,
  );
  return salvarRelatorio("diario", periodo, html);
}

export async function gerarRelatorioSemanal(dataReferencia = new Date()) {
  const inicioSemana = new Date(dataReferencia);
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
  inicioSemana.setHours(0, 0, 0, 0);
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(fimSemana.getDate() + 7);

  const [cadastros, atendimentos, alertasNovos] = await Promise.all([
    prisma.cadastroIndividual.count({ where: { atualizadoEm: { gte: inicioSemana, lt: fimSemana } } }),
    prisma.atendimento.count({ where: { dataAtendimento: { gte: inicioSemana, lt: fimSemana } } }),
    prisma.alerta.count({ where: { criadoEm: { gte: inicioSemana, lt: fimSemana } } }),
  ]);

  const periodo = `${inicioSemana.toISOString().slice(0, 10)}_a_${fimSemana.toISOString().slice(0, 10)}`;
  const html = envolverHtml(
    `Relatório semanal — ${periodo}`,
    `<table><tr><th>Cadastros individuais atualizados</th><td>${cadastros}</td></tr>
     <tr><th>Atendimentos na semana</th><td>${atendimentos}</td></tr>
     <tr><th>Alertas novos</th><td>${alertasNovos}</td></tr></table>`,
  );
  return salvarRelatorio("semanal", periodo, html);
}

// requisito 23: avaliação automática ao final de cada quadrimestre.
export async function gerarAvaliacaoQuadrimestral(quadrimestre: Quadrimestre, ano: number) {
  await prisma.$executeRawUnsafe(`CALL recalcular_indicadores_qualidade($1::"Quadrimestre", $2::int)`, quadrimestre, ano);
  await prisma.$executeRawUnsafe(`SELECT verificar_alertas($1::"Quadrimestre", $2::int)`, quadrimestre, ano);

  const resultados = await prisma.resultadoIndicador.findMany({
    where: { quadrimestre, ano },
    include: { equipe: { select: { nome: true, tipo: true } }, indicador: { select: { codigo: true, nome: true } } },
    orderBy: [{ equipe: { nome: "asc" } }, { indicador: { codigo: "asc" } }],
  });

  const linhas = resultados
    .map(
      (r) =>
        `<tr><td>${r.equipe.nome}</td><td>${r.equipe.tipo}</td><td>${r.indicador.codigo}</td><td>${Number(r.valorCalculado).toFixed(2)}</td><td>${r.classificacao}</td></tr>`,
    )
    .join("");

  const periodo = `${quadrimestre}-${ano}`;
  const html = envolverHtml(
    `Avaliação quadrimestral — ${periodo}`,
    `<table><tr><th>Equipe</th><th>Tipo</th><th>Indicador</th><th>Valor</th><th>Classificação</th></tr>${linhas}</table>`,
  );
  return salvarRelatorio("quadrimestral", periodo, html);
}
