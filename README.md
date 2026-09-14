# Painel SUS Brasil 360

Painel de gestão da Atenção Primária à Saúde integrado ao e-SUS AB PEC, self-hosted (Docker,
sem dependência de nuvem), rodando na mesma máquina/rede do e-SUS da prefeitura.

## Requisitos do servidor

- Linux com Docker + Docker Compose plugin.
- PostgreSQL do e-SUS AB PEC acessível na mesma máquina (ou na rede local), com um usuário
  somente-leitura para o `postgres_fdw` (ver `docs/esus-fdw.md`).
- Para acesso via `previne.local` na rede local (requisito 27): a máquina precisa estar em uma
  LAN com suporte a mDNS (a maioria das redes domésticas/pequenas redes tem isso por padrão).

## Instalação

```bash
cp .env.example .env
# edite .env: ESUS_FDW_HOST/PORT/DBNAME/USER/PASSWORD, AUTH_SECRET

docker compose up -d --build
```

Isso sobe 4 serviços:

- `db`: Postgres 16 + `postgres_fdw` + `pg_cron`, dados persistidos no volume `painel_db_data`.
- `app`: aplicação Next.js (porta 3000). No primeiro start, roda `prisma migrate deploy` (cria as
  tabelas), o seed (usuário `gestor_local` inicial — ver `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`
  em `.env`) e os scripts em `sql/` (FDW, motor de cálculo, agendamentos pg_cron).
- `worker`: processo separado para geração de relatórios/avaliação quadrimestral (o que o Postgres
  não consegue fazer sozinho — ver `sql/05_sincronizacao_automatica.sql`).
- `avahi`: publica `previne.local` via mDNS na rede local (requisito 27); roda com
  `network_mode: host`, então só funciona em Linux.

Acesse `http://previne.local:3000` (ou `http://<IP-do-servidor>:3000`) e entre com o usuário
gestor_local semeado no primeiro deploy.

## Funcionamento sem internet

O sistema funciona inteiramente na rede local, sem nenhum ponto de acesso externo (dashboard,
sincronização com o e-SUS, cálculo de indicadores, relatórios) — a funcionalidade de Alertas por
SMS (que era o único acesso externo permitido) foi removida do sistema.

## O que ainda precisa de atenção antes de produção

Ver `docs/esus-fdw.md` (nomes de coluna do e-SUS a confirmar contra a base real, etapa de
cadastros individuais/domiciliares ainda desabilitada) e `docs/indicadores-qualidade.md`
(C2-C7/B1-B6/M1-M2 são stubs até os critérios oficiais da Nota Metodológica vigente serem
inseridos em `boas_praticas_criterios`/`indicadores_catalogo`).

## Desenvolvimento local

```bash
npm install
npm run dev
```

Sem um Postgres local configurado (`DATABASE_URL` em `.env`), as páginas que consultam o banco
vão falhar — para desenvolvimento completo, suba pelo menos o serviço `db` via
`docker compose up -d db` e aponte `DATABASE_URL` para `localhost` (publique a porta 5432 do
serviço `db` se for rodar `next dev` fora do Docker).
