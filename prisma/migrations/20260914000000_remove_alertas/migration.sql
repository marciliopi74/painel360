-- DropForeignKey
ALTER TABLE "alertas" DROP CONSTRAINT IF EXISTS "alertas_profissional_id_fkey";
ALTER TABLE "alertas" DROP CONSTRAINT IF EXISTS "alertas_indicador_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "alertas";
