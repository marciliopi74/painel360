// requisito 25: envio de alerta por SMS — único acesso externo à internet permitido pelo
// sistema (requisito 28). Implementação genérica via HTTP; endpoint exato depende do provedor
// contratado pela prefeitura (Zenvia/Twilio/etc.) — ajustar ENVIAR_SMS_URL/corpo por provedor.
export async function enviarSms(telefone: string, mensagem: string): Promise<void> {
  const token = process.env.SMS_API_TOKEN;
  const provedor = process.env.SMS_PROVIDER ?? "zenvia";

  if (!token) {
    console.warn(`[sms] SMS_API_TOKEN não configurado — alerta para ${telefone} não foi enviado.`);
    return;
  }

  if (provedor === "zenvia") {
    const resp = await fetch("https://api.zenvia.com/v2/channels/sms/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-TOKEN": token },
      body: JSON.stringify({
        from: process.env.SMS_FROM ?? "PainelSUS",
        to: telefone,
        contents: [{ type: "text", text: mensagem }],
      }),
    });
    if (!resp.ok) {
      throw new Error(`Falha ao enviar SMS via Zenvia: ${resp.status} ${await resp.text()}`);
    }
    return;
  }

  throw new Error(`Provedor de SMS não suportado: ${provedor}`);
}
