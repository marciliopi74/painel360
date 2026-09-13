"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function OrdenarSelect({ selecionado, opcoes }: { selecionado: string; opcoes: readonly { valor: string; rotulo: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function aoMudar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ordenar", valor);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-label-sm text-on-surface-variant">Ordenação:</span>
      <select
        value={selecionado}
        onChange={(e) => aoMudar(e.target.value)}
        className="bg-surface-container-lowest border border-outline-variant/50 rounded-lg text-label-sm text-on-surface py-1 px-2.5 focus:outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  );
}
