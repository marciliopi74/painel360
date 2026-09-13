import { prisma } from "@/lib/prisma";
import { rotuloPapel } from "@/lib/rbac";
import { Icon } from "@/components/Icon";
import { NovoUsuarioForm } from "./NovoUsuarioForm";
import { ToggleAtivo } from "./ToggleAtivo";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes[1]?.[0] ?? "")).toUpperCase();
}

// Rota já é restrita a gestor_local pelo middleware (requisito 4).
export default async function UsuariosPage() {
  const usuarios = await prisma.usuario.findMany({
    where: { id: { not: "00000000-0000-0000-0000-000000000001" } },
    orderBy: { nome: "asc" },
  });
  const ativos = usuarios.filter((u) => u.ativo).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-headline-lg text-on-surface">Usuários do Sistema</h1>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Gestão de acessos e papéis institucionais do painel.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-primary text-label-sm font-semibold self-start">
          <Icon name="group" className="text-body-md" />
          {usuarios.length} cadastrados • {ativos} ativos
        </span>
      </div>

      <NovoUsuarioForm />

      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/60 border-b border-outline-variant/40 text-on-surface-variant text-label-sm uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Usuário</th>
                <th className="py-3 px-3 font-semibold">Papel</th>
                <th className="py-3 px-3 font-semibold">Telefone</th>
                <th className="py-3 px-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20 text-body-sm">
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 px-4 text-center text-on-surface-variant">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low/40 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary flex items-center justify-center font-bold text-label-md shrink-0">
                        {iniciais(u.nome)}
                      </div>
                      <div>
                        <div className="font-semibold text-on-surface">{u.nome}</div>
                        <div className="text-label-sm text-on-surface-variant">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-on-surface font-medium">{rotuloPapel(u.papel)}</td>
                  <td className="py-3.5 px-3 text-on-surface-variant">{u.telefone}</td>
                  <td className="py-3.5 px-3">
                    <ToggleAtivo id={u.id} ativo={u.ativo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
