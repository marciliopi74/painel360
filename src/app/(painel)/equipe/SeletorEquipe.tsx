"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function SeletorEquipe({
  equipeId,
  opcoes,
}: {
  equipeId: string;
  opcoes: { id: string; nome: string; tipo: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function aoMudar(novoId: string) {
    const query = searchParams.toString();
    router.push(`/equipe/${novoId}${query ? `?${query}` : ""}`);
  }

  return (
    <select
      aria-label="Selecione a equipe"
      value={equipeId}
      onChange={(e) => aoMudar(e.target.value)}
      className="w-full sm:w-80 appearance-none bg-surface-container-low hover:bg-surface-container border border-outline-variant/50 rounded-lg py-2 pl-3 pr-10 text-headline-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors cursor-pointer font-semibold"
    >
      {opcoes.map((eq) => (
        <option key={eq.id} value={eq.id}>
          {eq.nome} ({eq.tipo})
        </option>
      ))}
    </select>
  );
}
