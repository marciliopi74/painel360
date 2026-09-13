"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

const CHAVE_EMAIL_LEMBRADO = "painel-sus:login-email";

export function CamposLogin() {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const lembrarRef = useRef<HTMLInputElement>(null);

  // lê localStorage e ajusta os campos via DOM diretamente (não via setState) — evita re-render
  // em cascata só pra hidratar um valor que só existe no navegador.
  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE_EMAIL_LEMBRADO);
    if (salvo && emailRef.current && lembrarRef.current) {
      emailRef.current.value = salvo;
      lembrarRef.current.checked = true;
    }
  }, []);

  function aoMudarEmail(valor: string) {
    if (lembrarRef.current?.checked) localStorage.setItem(CHAVE_EMAIL_LEMBRADO, valor);
  }

  function aoMudarLembrar(marcado: boolean) {
    if (marcado) localStorage.setItem(CHAVE_EMAIL_LEMBRADO, emailRef.current?.value ?? "");
    else localStorage.removeItem(CHAVE_EMAIL_LEMBRADO);
  }

  return (
    <>
      <div>
        <label htmlFor="email" className="block text-label-md text-on-surface font-semibold mb-1">
          E-mail institucional
        </label>
        <div className="relative rounded-lg shadow-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
            <Icon name="person" className="text-body-lg" />
          </span>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            ref={emailRef}
            onChange={(e) => aoMudarEmail(e.target.value)}
            placeholder="nome@saude.gov.br"
            className="block w-full pl-10 pr-3 py-2.5 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface text-body-md placeholder:text-outline-variant focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="senha" className="block text-label-md text-on-surface font-semibold mb-1">
          Senha de acesso
        </label>
        <div className="relative rounded-lg shadow-sm">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline">
            <Icon name="lock" className="text-body-lg" />
          </span>
          <input
            id="senha"
            name="senha"
            type={mostrarSenha ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="block w-full pl-10 pr-10 py-2.5 bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-on-surface text-body-md placeholder:text-outline-variant focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-colors"
          />
          <button
            type="button"
            onClick={() => setMostrarSenha((v) => !v)}
            title="Mostrar ou ocultar senha"
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors"
          >
            <Icon name={mostrarSenha ? "visibility_off" : "visibility"} className="text-body-lg" />
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer pt-1">
        <input
          type="checkbox"
          ref={lembrarRef}
          onChange={(e) => aoMudarLembrar(e.target.checked)}
          className="h-4 w-4 rounded border-outline-variant text-primary-container focus:ring-primary-container focus:ring-offset-0"
        />
        <span className="text-label-md text-on-surface">Lembrar meu e-mail neste dispositivo</span>
      </label>
    </>
  );
}
