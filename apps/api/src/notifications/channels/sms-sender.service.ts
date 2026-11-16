import { Injectable, Logger } from "@nestjs/common";

/**
 * Envoi SMS via l'API REST de Twilio (demande du 10 nov. 2026, point 4 :
 * "prévoir les notif OTP SMS... en attendant le paiement de ses
 * services") — même principe que WhatsAppSenderService (même endpoint
 * Twilio Messages.json, sans le préfixe "whatsapp:"), mais avec un
 * avantage pratique sur WhatsApp : un SMS part vers n'importe quel numéro
 * sans action préalable du destinataire, alors que le numéro WhatsApp
 * bac à sable de Twilio exige d'abord un "join <code>" (voir le
 * commentaire de WhatsAppSenderService). Tant que TWILIO_SMS_FROM n'est
 * pas configuré (numéro Twilio payant, distinct du numéro WhatsApp), ce
 * canal reste simplement indisponible — `estConfigure()` le dit
 * honnêtement à l'appelant plutôt que de tenter un envoi qui échouerait.
 */
@Injectable()
export class SmsSenderService {
  private readonly logger = new Logger(SmsSenderService.name);

  estConfigure(): boolean {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SMS_FROM);
  }

  async envoyer(telephoneDestinataire: string, texte: string): Promise<boolean> {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const de = process.env.TWILIO_SMS_FROM;
    if (!sid || !token || !de) return false;

    try {
      const reponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ From: de, To: telephoneDestinataire, Body: texte }).toString(),
      });
      if (!reponse.ok) {
        this.logger.error(`Twilio a refusé l'envoi SMS (${reponse.status}): ${await reponse.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi SMS via Twilio: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
