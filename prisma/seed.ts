import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// UUID fixo referenciado por sql/05_alertas_relatorios.sql (disparar_sincronizacao_automatica)
// como "disparada_por" das sincronizações automáticas do pg_cron.
const USUARIO_SISTEMA_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  await prisma.usuario.upsert({
    where: { id: USUARIO_SISTEMA_ID },
    update: {},
    create: {
      id: USUARIO_SISTEMA_ID,
      nome: "Sincronização Automática (sistema)",
      email: "sistema@previne.local",
      senhaHash: await bcrypt.hash(randomUUID(), 10), // login desabilitado, senha irrelevante
      telefone: "00000000000",
      papel: "gestor_local",
      ativo: false,
    },
  });

  const emailAdmin = process.env.SEED_ADMIN_EMAIL ?? "admin@previne.local";
  const senhaAdmin = process.env.SEED_ADMIN_PASSWORD ?? "troque-esta-senha";

  await prisma.usuario.upsert({
    where: { email: emailAdmin },
    update: {},
    create: {
      nome: "Administrador",
      email: emailAdmin,
      senhaHash: await bcrypt.hash(senhaAdmin, 10),
      telefone: "00000000000",
      papel: "gestor_local",
      ativo: true,
    },
  });

  console.log(`Usuário gestor_local inicial: ${emailAdmin} (defina SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD para customizar).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
