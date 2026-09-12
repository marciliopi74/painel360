import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const credenciaisSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        senha: { label: "Senha", type: "password" },
      },
      authorize: async (credenciais) => {
        const dados = credenciaisSchema.safeParse(credenciais);
        if (!dados.success) return null;

        const usuario = await prisma.usuario.findUnique({ where: { email: dados.data.email } });
        if (!usuario || !usuario.ativo) return null;

        const senhaValida = await bcrypt.compare(dados.data.senha, usuario.senhaHash);
        if (!senhaValida) return null;

        return {
          id: usuario.id,
          name: usuario.nome,
          email: usuario.email,
          papel: usuario.papel,
          profissionalId: usuario.profissionalId,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id as string;
        token.papel = user.papel;
        token.profissionalId = user.profissionalId;
      }
      return token;
    },
    session: async ({ session, token }) => {
      session.user.id = token.id;
      session.user.papel = token.papel;
      session.user.profissionalId = token.profissionalId;
      return session;
    },
  },
});
