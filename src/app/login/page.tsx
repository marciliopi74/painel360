import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { verificarConexaoEsus } from "@/lib/data/administracao";
import { Icon } from "@/components/Icon";
import { CamposLogin } from "./CamposLogin";
import pacote from "../../../package.json";

async function autenticar(formData: FormData) {
  "use server";

  const callbackUrl = (formData.get("callbackUrl") as string) || "/";

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      senha: formData.get("senha"),
      redirectTo: callbackUrl,
    });
  } catch (erro) {
    if (erro instanceof AuthError) {
      redirect(`/login?erro=1&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw erro;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const esusConectado = await verificarConexaoEsus();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header institucional */}
      <header className="flex items-center w-full px-4 h-16 bg-surface shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary-container flex items-center justify-center shadow-sm">
            <Icon name="local_hospital" className="text-headline-sm" />
          </div>
          <div>
            <h1 className="text-headline-sm text-primary font-bold tracking-tight leading-tight">SUS Brasil 360</h1>
            <p className="text-label-sm text-on-surface-variant leading-none">Atenção Primária à Saúde</p>
          </div>
        </div>
      </header>

      {/* Conteúdo central */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-md mx-auto space-y-4">
          {/* Status de conexão real com o e-SUS */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container border border-outline-variant/40 shadow-sm">
              <span className="relative flex h-2 w-2">
                {esusConectado && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary-fixed opacity-75" />}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${esusConectado ? "bg-secondary" : "bg-error"}`} />
              </span>
              <span className="text-label-md text-on-surface-variant font-medium">Servidor Local On-Premise</span>
              <span className="text-outline text-label-sm">•</span>
              <span className={`text-label-md font-semibold ${esusConectado ? "text-secondary" : "text-error"}`}>
                {esusConectado ? "e-SUS Conectado" : "e-SUS Indisponível"}
              </span>
            </div>
          </div>

          {/* Card de autenticação */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-5 sm:p-6 shadow-sm">
            <div className="mb-5 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container-low text-primary mb-3 ring-1 ring-primary/10">
                <Icon name="verified_user" className="text-headline-md" />
              </div>
              <h2 className="text-headline-md text-on-surface font-bold">Acesso ao Painel SUS Brasil 360</h2>
              <p className="text-body-sm text-on-surface-variant mt-1">Monitoramento e auditoria do e-SUS APS e Previne Brasil</p>
            </div>

            {params.erro && (
              <p className="mb-4 rounded-lg bg-error-container px-3 py-2.5 text-body-sm text-on-error-container flex items-center gap-2">
                <Icon name="error" className="text-body-lg shrink-0" />
                E-mail ou senha inválidos.
              </p>
            )}

            <form action={autenticar} className="space-y-4">
              <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
              <CamposLogin />
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-11 bg-primary-container text-on-primary font-semibold text-label-lg rounded-lg shadow-sm hover:bg-primary transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>Entrar no Sistema</span>
                  <Icon name="login" className="text-body-lg" />
                </button>
              </div>
            </form>
          </div>

          {/* Nota de segurança (real: conexão local, sem afirmação de homologação) */}
          <div className="bg-surface-container-high/40 rounded-lg p-3.5 border border-outline-variant/30 text-on-surface-variant flex items-start gap-3">
            <Icon name="lock_clock" className="text-primary-container text-headline-sm mt-0.5 shrink-0" />
            <div className="text-body-sm">
              <p className="font-semibold text-on-surface text-label-sm uppercase tracking-wide">Ambiente local e offline</p>
              <p className="mt-0.5 text-label-sm leading-relaxed">
                Conexão direta com o banco de dados PostgreSQL local — os dados não saem da rede municipal, exceto o envio de SMS de alerta.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Rodapé */}
      <footer className="w-full px-4 py-4 border-t border-outline-variant/20 bg-surface-container-lowest text-center">
        <div className="max-w-md mx-auto space-y-1">
          <p className="text-label-md text-on-surface font-medium flex items-center justify-center gap-1">
            <Icon name="support_agent" className="text-body-lg text-primary" />
            Precisa de suporte? Contate a equipe de TI da Secretaria Municipal.
          </p>
          <div className="flex items-center justify-center gap-3 text-label-sm text-outline">
            <span>SUS Brasil 360 v{pacote.version}</span>
            <span>•</span>
            <span>Integrado ao e-SUS APS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
