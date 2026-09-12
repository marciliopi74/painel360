-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('gestor_local', 'secretario', 'coordenador', 'profissional');

-- CreateEnum
CREATE TYPE "TipoEquipe" AS ENUM ('ESF', 'EAP', 'EMULTI', 'ESB');

-- CreateEnum
CREATE TYPE "TipoEquipeAlvo" AS ENUM ('ESF_EAP', 'ESB', 'EMULTI');

-- CreateEnum
CREATE TYPE "CategoriaIndicador" AS ENUM ('boa_pratica_pontuada', 'indicador_proporcional', 'indicador_media');

-- CreateEnum
CREATE TYPE "UnidadeMedida" AS ENUM ('percentual', 'media');

-- CreateEnum
CREATE TYPE "Polaridade" AS ENUM ('maior_melhor', 'menor_melhor', 'neutra');

-- CreateEnum
CREATE TYPE "Quadrimestre" AS ENUM ('Q1', 'Q2', 'Q3');

-- CreateEnum
CREATE TYPE "Classificacao" AS ENUM ('otimo', 'bom', 'suficiente', 'regular');

-- CreateEnum
CREATE TYPE "TipoSincronizacao" AS ENUM ('manual', 'automatica');

-- CreateEnum
CREATE TYPE "StatusSincronizacao" AS ENUM ('em_andamento', 'concluida', 'erro', 'parcial');

-- CreateEnum
CREATE TYPE "TipoRelatorio" AS ENUM ('diario', 'semanal', 'quadrimestral');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "profissional_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nome" TEXT NOT NULL,
    "tipo" "TipoEquipe" NOT NULL,
    "ine" TEXT,
    "equipe_referencia_id" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fonte_id" BIGINT,
    "carga_horaria_semanal" INTEGER,

    CONSTRAINT "equipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipe_id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cns" TEXT NOT NULL,
    "cbo" TEXT NOT NULL,
    "eh_acs" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "fonte_id" BIGINT,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_individuais" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID NOT NULL,
    "equipe_id" UUID NOT NULL,
    "cidadao_cns" TEXT NOT NULL,
    "data_cadastro" DATE NOT NULL,
    "tem_erro" BOOLEAN NOT NULL DEFAULT false,
    "tipo_erro" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fonte_id" BIGINT,

    CONSTRAINT "cadastros_individuais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cadastros_domiciliares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID NOT NULL,
    "equipe_id" UUID NOT NULL,
    "endereco_referencia" TEXT NOT NULL,
    "data_cadastro" DATE NOT NULL,
    "tem_erro" BOOLEAN NOT NULL DEFAULT false,
    "tipo_erro" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fonte_id" BIGINT,

    CONSTRAINT "cadastros_domiciliares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID,
    "equipe_id" UUID NOT NULL,
    "data_atendimento" DATE NOT NULL,
    "tipo_atendimento" TEXT NOT NULL,
    "cbo" TEXT,
    "tem_erro" BOOLEAN NOT NULL DEFAULT false,
    "tipo_erro" TEXT,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fonte_id" BIGINT,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "indicadores_catalogo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo_equipe_alvo" "TipoEquipeAlvo" NOT NULL,
    "categoria" "CategoriaIndicador" NOT NULL,
    "unidade_medida" "UnidadeMedida" NOT NULL,
    "polaridade" "Polaridade" NOT NULL,
    "parametro_otimo_min" DECIMAL(65,30),
    "parametro_otimo_max" DECIMAL(65,30),
    "parametro_bom_min" DECIMAL(65,30),
    "parametro_bom_max" DECIMAL(65,30),
    "parametro_suficiente_min" DECIMAL(65,30),
    "parametro_suficiente_max" DECIMAL(65,30),
    "ano_referencia" INTEGER NOT NULL,

    CONSTRAINT "indicadores_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boas_praticas_criterios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "indicador_id" UUID NOT NULL,
    "codigo_criterio" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "pontos" DECIMAL(65,30) NOT NULL,
    "janela_tempo_meses" INTEGER,

    CONSTRAINT "boas_praticas_criterios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_indicadores" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipe_id" UUID NOT NULL,
    "indicador_id" UUID NOT NULL,
    "quadrimestre" "Quadrimestre" NOT NULL,
    "ano" INTEGER NOT NULL,
    "numerador" DECIMAL(65,30) NOT NULL,
    "denominador" DECIMAL(65,30) NOT NULL,
    "valor_calculado" DECIMAL(65,30) NOT NULL,
    "classificacao" "Classificacao" NOT NULL,
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_indicadores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boas_praticas_pontuacao_pessoa" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipe_id" UUID NOT NULL,
    "indicador_id" UUID NOT NULL,
    "cidadao_cns" TEXT NOT NULL,
    "criterio_id" UUID NOT NULL,
    "atingiu" BOOLEAN NOT NULL,
    "quadrimestre" "Quadrimestre" NOT NULL,
    "ano" INTEGER NOT NULL,

    CONSTRAINT "boas_praticas_pontuacao_pessoa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profissional_id" UUID NOT NULL,
    "indicador_id" UUID NOT NULL,
    "mensagem" TEXT NOT NULL,
    "enviado_sms" BOOLEAN NOT NULL DEFAULT false,
    "enviado_em" TIMESTAMPTZ(6),
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorios_gerados" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "TipoRelatorio" NOT NULL,
    "periodo_referencia" TEXT NOT NULL,
    "arquivo_url" TEXT,
    "gerado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relatorios_gerados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacoes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "disparada_por" UUID NOT NULL,
    "tipo" "TipoSincronizacao" NOT NULL,
    "status" "StatusSincronizacao" NOT NULL,
    "etapa_atual" TEXT,
    "total_estimado" INTEGER,
    "processados" INTEGER NOT NULL DEFAULT 0,
    "iniciado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluido_em" TIMESTAMPTZ(6),
    "erro_mensagem" TEXT,

    CONSTRAINT "sincronizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "equipes_fonte_id_key" ON "equipes"("fonte_id");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_fonte_id_key" ON "profissionais"("fonte_id");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_individuais_fonte_id_key" ON "cadastros_individuais"("fonte_id");

-- CreateIndex
CREATE UNIQUE INDEX "cadastros_domiciliares_fonte_id_key" ON "cadastros_domiciliares"("fonte_id");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_fonte_id_key" ON "atendimentos"("fonte_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_catalogo_codigo_key" ON "indicadores_catalogo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "boas_praticas_criterios_indicador_id_codigo_criterio_key" ON "boas_praticas_criterios"("indicador_id", "codigo_criterio");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_indicadores_equipe_id_indicador_id_quadrimestre__key" ON "resultados_indicadores"("equipe_id", "indicador_id", "quadrimestre", "ano");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipes" ADD CONSTRAINT "equipes_equipe_referencia_id_fkey" FOREIGN KEY ("equipe_referencia_id") REFERENCES "equipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissionais" ADD CONSTRAINT "profissionais_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_individuais" ADD CONSTRAINT "cadastros_individuais_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_individuais" ADD CONSTRAINT "cadastros_individuais_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_domiciliares" ADD CONSTRAINT "cadastros_domiciliares_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cadastros_domiciliares" ADD CONSTRAINT "cadastros_domiciliares_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boas_praticas_criterios" ADD CONSTRAINT "boas_praticas_criterios_indicador_id_fkey" FOREIGN KEY ("indicador_id") REFERENCES "indicadores_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_indicadores" ADD CONSTRAINT "resultados_indicadores_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_indicadores" ADD CONSTRAINT "resultados_indicadores_indicador_id_fkey" FOREIGN KEY ("indicador_id") REFERENCES "indicadores_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boas_praticas_pontuacao_pessoa" ADD CONSTRAINT "boas_praticas_pontuacao_pessoa_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boas_praticas_pontuacao_pessoa" ADD CONSTRAINT "boas_praticas_pontuacao_pessoa_indicador_id_fkey" FOREIGN KEY ("indicador_id") REFERENCES "indicadores_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boas_praticas_pontuacao_pessoa" ADD CONSTRAINT "boas_praticas_pontuacao_pessoa_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "boas_praticas_criterios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_profissional_id_fkey" FOREIGN KEY ("profissional_id") REFERENCES "profissionais"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_indicador_id_fkey" FOREIGN KEY ("indicador_id") REFERENCES "indicadores_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sincronizacoes" ADD CONSTRAINT "sincronizacoes_disparada_por_fkey" FOREIGN KEY ("disparada_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

