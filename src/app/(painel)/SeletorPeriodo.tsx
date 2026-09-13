"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/Icon";

export function SeletorPeriodo({
  periodos,
  selecionado,
}: {
  periodos: { valor: string; rotulo: string }[];
  selecionado: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function aoMudar(valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("periodo", valor);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center space-x-2 w-full sm:w-auto">
      <Icon name="calendar_today" className="text-primary text-body-lg" />
      <div className="relative w-full sm:w-64">
        <select
          value={selecionado}
          onChange={(e) => aoMudar(e.target.value)}
          className="w-full h-10 pl-3 pr-8 rounded-lg bg-surface text-on-surface border border-outline-variant/60 text-label-md focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container"
        >
          {periodos.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
