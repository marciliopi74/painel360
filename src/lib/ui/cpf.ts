// nu_cpf no e-SUS vem só com os 11 dígitos, sem máscara — formata ###.###.###-##. Se por algum
// motivo não vier com exatamente 11 dígitos (dado incompleto/malformado), mostra cru em vez de
// aplicar uma máscara errada.
export function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, "");
  if (digitos.length !== 11) return cpf;
  return `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
}
