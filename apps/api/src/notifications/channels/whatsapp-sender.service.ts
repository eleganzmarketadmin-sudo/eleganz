import { Injectable, Logger } from "@nestjs/common";

/**
 * Envoi WhatsApp via l'API REST de Twilio (16 oct. 2026 — "je veux que la
 * réception d'un code par email/WhatsApp soit branché"). Appel direct en
 * `fetch`, même principe que EmailSenderService.
 *
 * ATTENTION — limite connue, à faire savoir à la plateforme : tant que
 * TWILIO_WHATSAPP_FROM pointe vers le numéro bac à sable (sandbox) Twilio,
 * chaque destinataire doit d'abord avoir envoyé "join <code>" à ce numéro
 * depuis WhatsApp pour pouvoir recevoir quoi que ce soit — ça ne marche
 * pas pour un client final qui n'a jamais entendu parler de ce numéro.
 * Pour de vrais clients, il faut un numéro WhatsApp Business approuvé par
 * Meta (processus séparé, pas instantané). En attendant, ce canal n'est
 * utilisable qu'avec des numéros ayant rejoint le bac à sable.
 */
@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);

  estConfigure(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
  }

  async envoyer(telephoneDestinataire: string, texte: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const de = process.env.TWILIO_WHATSAPP_FROM;
    if (!sid || !token || !de) return false;

    const versNumero = telephoneDestinataire.startsWith("whatsapp:") ? telephoneDestinataire : `whatsapp:${telephoneDestinataire}`;
    const deNumero = de.startsWith("whatsapp:") ? de : `whatsapp:${de}`;

    try {
      const reponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: deNumero, To: versNumero, Body: texte }).toString(),
      });
      if (!reponse.ok) {
        this.logger.error(`Twilio a refusé l'envoi (${reponse.status}): ${await reponse.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi WhatsApp via Twilio: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
