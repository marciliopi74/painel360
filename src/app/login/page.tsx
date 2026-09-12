import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

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

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Painel SUS Brasil 360</h1>
        <p className="mt-1 text-sm text-zinc-500">Entre com seu e-mail e senha.</p>

        {params.erro && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            E-mail ou senha inválidos.
          </p>
        )}

        <form action={autenticar} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="callbackUrl" value={params.callbackUrl ?? "/"} />
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-zinc-700">
              Senha
            </label>
            <input
              id="senha"
              name="senha"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
