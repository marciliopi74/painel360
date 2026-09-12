FROM postgres:16

# postgres_fdw já vem no contrib padrão da imagem; só falta instalar pg_cron.
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-16-cron \
  && rm -rf /var/lib/apt/lists/*
