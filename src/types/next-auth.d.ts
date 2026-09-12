import type { Papel } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    papel: Papel;
    profissionalId: string | null;
  }

  interface Session {
    user: {
      id: string;
      papel: Papel;
      profissionalId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    papel: Papel;
    profissionalId: string | null;
  }
}
