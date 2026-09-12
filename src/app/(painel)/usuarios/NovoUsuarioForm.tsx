"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PAPEIS = ["gestor_local", "secretario", "coordenador", "profissional"] as const;

export function NovoUsuarioForm() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(formData: FormData) {
    setEnviando(true);
    setErro(null);
    try {
      const resp = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: formData.get("nome"),
          email: formData.get("email"),
          senha: formData.get("senha"),
          telefone: formData.get("telefone"),
          papel: formData.get("papel"),
        }),
      });
      if (!resp.ok) {
        const dados = await resp.json();
        setErro(typeof dados.erro === "string" ? dados.erro : "Não foi possível criar o usuário.");
        return;
      }
      (document.getElementById("form-novo-usuario") as HTMLFormElement)?.reset();
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      id="form-novo-usuario"
      action={enviar}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
    >
      <div>
        <label className="block text-xs font-medium text-zinc-700">Nome</label>
        <input name="nome" required className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">E-mail</label>
        <input
          name="email"
          type="email"
          required
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Senha</label>
        <input
          name="senha"
          type="password"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Telefone</label>
        <input name="telefone" required className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm" />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Papel</label>
        <select name="papel" className="mt-1 w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="lg:col-span-5">
        {erro && <p className="mb-2 text-sm text-red-600">{erro}</p>}
        <button
          type="submit"
          disabled={enviando}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {enviando ? "Criando..." : "Criar usuário"}
        </button>
      </div>
    </form>
  );
}
