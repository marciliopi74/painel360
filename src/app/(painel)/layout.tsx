import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { podeGerenciarUsuarios, rotuloPapel } from "@/lib/rbac";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/cadastros", label: "Cadastros" },
  { href: "/atendimentos", label: "Atendimentos" },
  { href: "/indicadores-qualidade", label: "Indicadores de Qualidade" },
  { href: "/alertas", label: "Alertas" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/sincronizacao", label: "Sincronização" },
] as const;

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const usuario = session!.user;

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-zinc-900">Painel SUS Brasil 360</span>
            <nav className="flex flex-wrap gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  {item.label}
                </Link>
              ))}
              {podeGerenciarUsuarios(usuario) && (
                <Link
                  href="/usuarios"
                  className="rounded-md px-2.5 py-1.5 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  Usuários
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-600">
            <span>
              {usuario.name} <span className="text-zinc-400">· {rotuloPapel(usuario.papel)}</span>
            </span>
            <form action={sair}>
              <button type="submit" className="rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
