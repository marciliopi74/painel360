import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { equipeIdPermitido } from "@/lib/data/escopo";

// equipes visíveis para o filtro de tela (respeitando o escopo do usuário — profissional só
// enxerga a própria equipe, e nesse caso o filtro nem é exibido pela UI).
export async function listarEquipesVisiveis(usuario: UsuarioSessao) {
  const equipeId = await equipeIdPermitido(usuario);
  return prisma.equipe.findMany({
    where: { ativo: true, ...(equipeId ? { id: equipeId } : {}) },
    select: { id: true, nome: true, tipo: true },
    orderBy: { nome: "asc" },
  });
}
