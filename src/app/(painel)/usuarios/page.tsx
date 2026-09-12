import { prisma } from "@/lib/prisma";
import { rotuloPapel } from "@/lib/rbac";
import { NovoUsuarioForm } from "./NovoUsuarioForm";
import { ToggleAtivo } from "./ToggleAtivo";

// Rota já é restrita a gestor_local pelo middleware (requisito 4).
export default async function UsuariosPage() {
  const usuarios = await prisma.usuario.findMany({
    where: { id: { not: "00000000-0000-0000-0000-000000000001" } },
    orderBy: { nome: "asc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-900">Usuários</h1>
        <p className="text-sm text-zinc-500">Gestão de usuários e papéis de acesso (restrito ao gestor local).</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <NovoUsuarioForm />
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-2 px-3">Nome</th>
              <th className="py-2 px-3">E-mail</th>
              <th className="py-2 px-3">Telefone</th>
              <th className="py-2 px-3">Papel</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-zinc-100">
                <td className="py-2 px-3">{u.nome}</td>
                <td className="py-2 px-3">{u.email}</td>
                <td className="py-2 px-3">{u.telefone}</td>
                <td className="py-2 px-3">{rotuloPapel(u.papel)}</td>
                <td className="py-2 px-3">
                  <ToggleAtivo id={u.id} ativo={u.ativo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
