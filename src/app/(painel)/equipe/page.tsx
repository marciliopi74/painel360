import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listarEquipesParaSeletor } from "@/lib/data/equipeDetalhe";

// requisito 20: entrada da "Visão da Equipe" — redireciona para a primeira equipe visível ao
// usuário; o seletor dentro da própria tela troca entre equipes sem passar por aqui de novo.
export default async function EquipeIndexPage() {
  const session = await auth();
  const equipes = await listarEquipesParaSeletor(session!.user);

  if (equipes.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-center text-body-sm text-on-surface-variant">
        Nenhuma equipe disponível para o seu usuário.
      </div>
    );
  }

  redirect(`/equipe/${equipes[0].id}`);
}
