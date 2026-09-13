"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";

export function MaisMenu({
  itens,
  aoSair,
}: {
  itens: { href: string; label: string; icon: string }[];
  aoSair: () => Promise<void>;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("click", aoClicarFora);
    return () => document.removeEventListener("click", aoClicarFora);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {aberto && (
        <div className="absolute bottom-14 right-0 w-56 rounded-lg border border-outline-variant/40 bg-surface-container-lowest shadow-lg overflow-hidden">
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 px-4 py-3 text-body-sm text-on-surface hover:bg-surface-container"
            >
              <Icon name={item.icon} className="text-body-lg text-on-surface-variant" />
              {item.label}
            </Link>
          ))}
          <form action={aoSair}>
            <button
              type="submit"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-body-sm text-error hover:bg-error-container/40 border-t border-outline-variant/30"
            >
              <Icon name="logout" className="text-body-lg" />
              Sair
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex flex-col items-center justify-center text-on-surface-variant px-3 py-1 text-label-sm hover:text-on-surface"
      >
        <Icon name="more_horiz" />
        <span>Mais</span>
      </button>
    </div>
  );
}
