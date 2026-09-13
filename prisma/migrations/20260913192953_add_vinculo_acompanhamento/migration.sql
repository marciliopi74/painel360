-- AlterTable
ALTER TABLE "cadastros_individuais" ADD COLUMN     "beneficiario_bpc_pbf" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "configuracao_sistema" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "populacao_municipio" INTEGER,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracao_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "satisfacao_equipe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipe_id" UUID NOT NULL,
    "quadrimestre" "Quadrimestre" NOT NULL,
    "ano" INTEGER NOT NULL,
    "percentual_avaliacoes" DECIMAL(65,30) NOT NULL,
    "atualizado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "satisfacao_equipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_vinculo_acompanhamento" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipe_id" UUID NOT NULL,
    "quadrimestre" "Quadrimestre" NOT NULL,
    "ano" INTEGER NOT NULL,
    "pessoas_cadastro_valido" INTEGER NOT NULL,
    "indice_ponderado_cadastro" DECIMAL(65,30) NOT NULL,
    "parametro_porte" INTEGER NOT NULL,
    "resultado_cadastro" DECIMAL(65,30) NOT NULL,
    "escore_cadastro" DECIMAL(65,30) NOT NULL,
    "classificacao_cadastro" "Classificacao" NOT NULL,
    "acompanhados_sem_criterio" INTEGER NOT NULL,
    "acompanhados_idoso_ou_crianca" INTEGER NOT NULL,
    "acompanhados_bpc_pbf" INTEGER NOT NULL,
    "acompanhados_idoso_crianca_bpc_pbf" INTEGER NOT NULL,
    "indice_ponderado_acompanhamento" DECIMAL(65,30) NOT NULL,
    "resultado_acompanhamento" DECIMAL(65,30) NOT NULL,
    "escore_acompanhamento_base" DECIMAL(65,30) NOT NULL,
    "bonus_satisfacao" DECIMAL(65,30) NOT NULL,
    "escore_acompanhamento" DECIMAL(65,30) NOT NULL,
    "classificacao_acompanhamento" "Classificacao" NOT NULL,
    "escore_final" DECIMAL(65,30) NOT NULL,
    "classificacao_final" "Classificacao" NOT NULL,
    "calculado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_vinculo_acompanhamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "satisfacao_equipe_equipe_id_quadrimestre_ano_key" ON "satisfacao_equipe"("equipe_id", "quadrimestre", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "resultados_vinculo_acompanhamento_equipe_id_quadrimestre_an_key" ON "resultados_vinculo_acompanhamento"("equipe_id", "quadrimestre", "ano");

-- AddForeignKey
ALTER TABLE "satisfacao_equipe" ADD CONSTRAINT "satisfacao_equipe_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_vinculo_acompanhamento" ADD CONSTRAINT "resultados_vinculo_acompanhamento_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "equipes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
