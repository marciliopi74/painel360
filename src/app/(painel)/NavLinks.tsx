"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

type ItemNav = { href: string; label: string; icon: string };

export function NavDesktop({ itens }: { itens: ItemNav[] }) {
  const pathname = usePathname();
  return (
    <>
      {itens.map((item) => {
        const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm transition-colors whitespace-nowrap ${
              ativo
                ? "bg-primary text-on-primary font-bold shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            }`}
          >
            <Icon name={item.icon} className="text-body-md" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function NavBottomItem({ href, label, icon }: ItemNav) {
  const pathname = usePathname();
  const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center px-3 py-1 text-label-sm rounded-full transition-colors ${
        ativo ? "bg-primary-container text-on-primary-container" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      <Icon name={icon} filled={ativo} />
      <span>{label}</span>
    </Link>
  );
}
