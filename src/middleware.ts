import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PREFIXOS_SOMENTE_GESTOR = ["/usuarios", "/configuracoes"];

export default auth((req) => {
  const { nextUrl } = req;
  const usuario = req.auth?.user;
  const emRotaPublica = nextUrl.pathname === "/login";

  if (!usuario && !emRotaPublica) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (usuario && emRotaPublica) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (
    usuario &&
    usuario.papel !== "gestor_local" &&
    PREFIXOS_SOMENTE_GESTOR.some((prefixo) => nextUrl.pathname.startsWith(prefixo))
  ) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|fonts/).*)"],
};
