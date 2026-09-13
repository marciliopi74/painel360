"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";

export function CopiarBotao({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — falha silenciosa, não é crítico.
    }
  }

  return (
    <button onClick={copiar} className="text-primary hover:text-on-surface transition-colors p-0.5" title="Copiar CNS" type="button">
      <Icon name={copiado ? "check" : "content_copy"} className="text-[16px]" />
    </button>
  );
}
