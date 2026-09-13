import { auth, signOut } from "@/lib/auth";
import { podeGerenciarUsuarios, podeDispararSincronizacao, rotuloPapel } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/Icon";
import { SyncStatus } from "./SyncStatus";
import { MaisMenu } from "./MaisMenu";
import { NavDesktop, NavBottomItem } from "./NavLinks";

const NAV_PRINCIPAL = [
  { href: "/", label: "Início", icon: "dashboard" },
  { href: "/cadastros", label: "Cadastros", icon: "how_to_reg" },
  { href: "/atendimentos", label: "Atendimentos", icon: "clinical_notes" },
  { href: "/indicadores-qualidade", label: "Indicadores", icon: "analytics" },
] as const;

const NAV_SECUNDARIA = [
  { href: "/equipe", label: "Visão da Equipe", icon: "groups" },
  { href: "/pendencias", label: "Pendências", icon: "pending_actions" },
  { href: "/alertas", label: "Alertas", icon: "notifications" },
  { href: "/relatorios", label: "Relatórios", icon: "description" },
  { href: "/avaliacao-quadrimestral", label: "Avaliação Quadrimestral", icon: "fact_check" },
  { href: "/vinculo-acompanhamento", label: "Vínculo e Acompanhamento", icon: "location_on" },
  { href: "/sincronizacao", label: "Sincronização", icon: "sync" },
] as const;

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const usuario = session!.user;
  const gerenciaUsuarios = podeGerenciarUsuarios(usuario);

  const ultimaSincronizacao = await prisma.sincronizacao.findFirst({
    orderBy: { iniciadoEm: "desc" },
    select: { id: true, status: true, iniciadoEm: true, concluidoEm: true, erroMensagem: true },
  });

  const navSecundariaCompleta = [
    ...NAV_SECUNDARIA,
    ...(gerenciaUsuarios ? [{ href: "/usuarios", label: "Usuários", icon: "manage_accounts" }] : []),
    ...(gerenciaUsuarios ? [{ href: "/configuracoes", label: "Administração", icon: "admin_panel_settings" }] : []),
  ];

  async function sair() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 md:pb-0">
      {/* TopAppBar */}
      <header className="flex justify-between items-center w-full px-4 h-16 sticky top-0 z-40 bg-surface shadow-sm">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-container text-primary shrink-0">
            <Icon name="local_hospital" className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-headline-sm text-primary font-bold truncate">SUS Brasil 360</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary text-label-sm border border-secondary-container">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Online
              </span>
            </div>
            <p className="text-body-sm text-on-surface-variant hidden md:block truncate">
              {usuario.name} · {rotuloPapel(usuario.papel)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SyncStatus
            ultimaSincronizacao={
              ultimaSincronizacao
                ? {
                    id: ultimaSincronizacao.id,
                    status: ultimaSincronizacao.status,
                    iniciadoEm: ultimaSincronizacao.iniciadoEm.toISOString(),
                    concluidoEm: ultimaSincronizacao.concluidoEm?.toISOString() ?? null,
                    erroMensagem: ultimaSincronizacao.erroMensagem,
                  }
                : null
            }
            podeDisparar={podeDispararSincronizacao(usuario)}
          />
          <form action={sair} className="hidden md:block">
            <button
              type="submit"
              title="Sair"
              className="flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            >
              <Icon name="logout" />
            </button>
          </form>
        </div>
      </header>

      {/* Navegação secundária (desktop/tablet) */}
      <nav className="hidden md:flex items-center gap-1.5 w-full px-4 sm:px-6 py-2 border-b border-outline-variant/40 bg-surface-container-lowest overflow-x-auto">
        <NavDesktop itens={[...NAV_PRINCIPAL, ...navSecundariaCompleta]} />
      </nav>

      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-5 flex-1 flex flex-col">{children}</main>

      {/* BottomNavBar (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-16 px-2 bg-surface shadow-md">
        {NAV_PRINCIPAL.map((item) => (
          <NavBottomItem key={item.href} {...item} />
        ))}
        <MaisMenu
          itens={navSecundariaCompleta.map((i) => ({ href: i.href, label: i.label, icon: i.icon }))}
          aoSair={sair}
        />
      </nav>
    </div>
  );
}
