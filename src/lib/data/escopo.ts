import { prisma } from "@/lib/prisma";
import type { UsuarioSessao } from "@/lib/rbac";
import { podeVerTodasEquipes } from "@/lib/rbac";

// requisito 3: retorna o equipeId ao qual o usuário está restrito, ou null se ele
// tem visão municipal completa (todos os papéis exceto profissional).
export async function equipeIdPermitido(usuario: UsuarioSessao): Promise<string | null> {
  if (podeVerTodasEquipes(usuario)) return null;
  if (!usuario.profissionalId) return "__nenhuma__"; // profissional sem vínculo: não vê nada

  const profissional = await prisma.profissional.findUnique({
    where: { id: usuario.profissionalId },
    select: { equipeId: true },
  });
  return profissional?.equipeId ?? "__nenhuma__";
}
