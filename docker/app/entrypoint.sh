#!/bin/bash
set -euo pipefail

echo "Aguardando banco de dados ficar disponível..."
until node -e "
const { URL } = require('node:url');
const net = require('node:net');
const u = new URL(process.env.DATABASE_URL);
const s = net.connect({ host: u.hostname, port: u.port || 5432 });
s.on('connect', () => { s.end(); process.exit(0); });
s.on('error', () => process.exit(1));
"; do
  sleep 2
done
echo "Banco de dados disponível."

# Idempotente: prisma migrate deploy usa lock consultivo do Postgres, o seed faz upsert e
# scripts/apply-sql.ts só usa CREATE OR REPLACE/DROP IF EXISTS/cron.schedule — seguro rodar
# tanto no container `app` quanto no `worker` toda vez que sobem.
npm run db:migrate
npm run db:seed
npm run db:apply-sql || echo "Aviso: alguns scripts SQL falharam (ver logs acima) — prosseguindo mesmo assim."

case "${1:-app}" in
  worker)
    exec npx tsx scripts/worker.ts
    ;;
  *)
    exec npm run start
    ;;
esac
