import Link from "next/link";
import { Icon } from "@/components/Icon";

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  itensNaPagina,
  itensPorPagina,
  paramNome,
  outrosParams,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  itensNaPagina: number;
  itensPorPagina: number;
  paramNome: string;
  outrosParams: URLSearchParams;
}) {
  function href(pagina: number) {
    const params = new URLSearchParams(outrosParams);
    params.set(paramNome, String(pagina));
    return `?${params.toString()}`;
  }

  if (total === 0) return null;

  const inicio = (pagina - 1) * itensPorPagina + 1;
  const fim = inicio + itensNaPagina - 1;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1">
      <div className="text-label-md text-on-surface-variant">
        Mostrando <strong className="text-on-surface">{inicio}–{fim}</strong> de{" "}
        <strong className="text-on-surface">{total.toLocaleString("pt-BR")}</strong> registros
      </div>
      {totalPaginas > 1 && (
        <div className="flex items-center gap-1">
          <Link
            href={href(Math.max(1, pagina - 1))}
            aria-disabled={pagina <= 1}
            className={`p-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest transition ${
              pagina <= 1 ? "pointer-events-none opacity-40 text-outline" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Icon name="chevron_left" className="text-body-md" />
          </Link>
          <span className="px-2 text-label-md text-on-surface-variant">
            Página {pagina} de {totalPaginas}
          </span>
          <Link
            href={href(Math.min(totalPaginas, pagina + 1))}
            aria-disabled={pagina >= totalPaginas}
            className={`p-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest transition ${
              pagina >= totalPaginas ? "pointer-events-none opacity-40 text-outline" : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
            }`}
          >
            <Icon name="chevron_right" className="text-body-md" />
          </Link>
        </div>
      )}
    </div>
  );
}
