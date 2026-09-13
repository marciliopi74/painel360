import type { Papel } from "@prisma/client";

export type UsuarioSessao = {
  id: string;
  papel: Papel;
  profissionalId: string | null;
};

// requisito 4: só o gestor_local administra usuários e configurações do sistema local.
export function podeGerenciarUsuarios(usuario: UsuarioSessao): boolean {
  return usuario.papel === "gestor_local";
}

// requisito 3: profissional só enxerga dados da própria equipe; os demais papéis têm
// visão municipal completa (gestor_local, secretario, coordenador não estão vinculados
// a uma equipe específica no schema atual).
export function podeVerTodasEquipes(usuario: UsuarioSessao): boolean {
  return usuario.papel !== "profissional";
}

export function podeDispararSincronizacao(usuario: UsuarioSessao): boolean {
  return usuario.papel === "gestor_local" || usuario.papel === "secretario" || usuario.papel === "coordenador";
}

const ROTULOS_PAPEL: Record<Papel, string> = {
  gestor_local: "Gestor local",
  secretario: "Secretário",
  coordenador: "Coordenador",
  profissional: "Profissional",
};

export function rotuloPapel(papel: Papel): string {
  return ROTULOS_PAPEL[papel];
}
