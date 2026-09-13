"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Papel } from "@prisma/client";
import { Icon } from "@/components/Icon";
import { rotuloPapel } from "@/lib/rbac";

const PAPEIS: Papel[] = ["gestor_local", "secretario", "coordenador", "profissional"];

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

  const campoClasse =
    "mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant/60 bg-surface text-body-sm text-on-surface focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container";
  const rotuloClasse = "block text-label-md text-on-surface-variant";

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/40 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="person_add" className="text-primary text-body-lg" />
        <h2 className="text-headline-sm text-on-surface">Novo Usuário</h2>
      </div>
      <form id="form-novo-usuario" action={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <div>
          <label className={rotuloClasse}>Nome</label>
          <input name="nome" required className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>E-mail</label>
          <input name="email" type="email" required className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Senha</label>
          <input name="senha" type="password" required minLength={8} className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Telefone</label>
          <input name="telefone" required placeholder="(00) 00000-0000" className={campoClasse} />
        </div>
        <div>
          <label className={rotuloClasse}>Papel</label>
          <select name="papel" className={`${campoClasse} appearance-none`}>
            {PAPEIS.map((p) => (
              <option key={p} value={p}>
                {rotuloPapel(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-5">
          {erro && (
            <p className="mb-2 flex items-center gap-1.5 text-body-sm text-error">
              <Icon name="error" className="text-body-md" />
              {erro}
            </p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-on-primary text-label-md font-semibold hover:bg-primary-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Icon name={enviando ? "hourglass_top" : "add"} className={`text-body-md ${enviando ? "sync-spinning" : ""}`} />
            {enviando ? "Criando..." : "Criar usuário"}
          </button>
        </div>
      </form>
    </div>
  );
}
