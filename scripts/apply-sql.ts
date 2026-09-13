// Aplica os scripts SQL complementares (extensões, FDW do e-SUS, motor de cálculo dos
// Indicadores de Qualidade, alertas e agendamentos pg_cron) depois que `prisma migrate deploy`
// já criou as tabelas base. Reexecutável: todo arquivo em sql/ usa CREATE OR REPLACE / DROP IF
// EXISTS / cron.schedule (que já faz upsert por nome de job), então rodar de novo em cada
// deploy é seguro e idempotente.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

// Chave arbitrária e fixa pro advisory lock desta rotina (só precisa não colidir com outro uso de
// pg_advisory_lock no banco — não há nenhum outro hoje). `app` e `worker` chamam este script no
// boot dos dois containers quase ao mesmo tempo; sem serializar, o segundo pode pegar um
// "tuple concurrently updated" no meio de um CREATE OR REPLACE FUNCTION do primeiro. Lock de
// sessão (não de transação) porque o script roda vários statements/arquivos sequenciais fora de
// uma transação só.
const LOCK_KEY = 727_272_001;

async function main() {
  const sqlDir = join(__dirname, "..", "sql");
  const arquivos = readdirSync(sqlDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

  let houveFalha = false;
  try {
    for (const arquivo of arquivos) {
      try {
        let sql = readFileSync(join(sqlDir, arquivo), "utf-8");

        sql = sql.replace(/\$\{(\w+)\}/g, (_, nome) => {
          const valor = process.env[nome];
          if (valor === undefined) {
            throw new Error(`Variável de ambiente ${nome} não definida (requerida por ${arquivo})`);
          }
          return valor;
        });

        console.log(`Aplicando ${arquivo}...`);
        await client.query(sql);
      } catch (erro) {
        // Não aborta os demais arquivos: por exemplo, 02_fdw_esus.sql falha se o Postgres do
        // e-SUS não estiver acessível no momento do deploy, mas o resto do sistema (auth,
        // dashboard, cadastro manual) deve continuar funcionando — a sincronização em si só
        // volta a funcionar quando a conectividade for corrigida e este script rodar de novo.
        houveFalha = true;
        console.error(`Falha ao aplicar ${arquivo} (continuando com os demais):`, erro);
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    await client.end();
  }

  if (houveFalha) {
    console.error("Um ou mais scripts SQL falharam — revise os logs acima.");
    process.exitCode = 1;
  } else {
    console.log("Todos os scripts SQL foram aplicados com sucesso.");
  }
}

main().catch((err) => {
  console.error("Falha ao aplicar scripts SQL:", err);
  process.exit(1);
});
