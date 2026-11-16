import { Injectable, Logger } from "@nestjs/common";

/**
 * Envoi d'email via l'API REST de Resend (16 oct. 2026 — "je veux que la
 * réception d'un code par email/WhatsApp soit branché"). Appel direct en
 * `fetch` plutôt qu'un SDK : Resend expose une API REST simple et ça évite
 * d'ajouter une dépendance npm pour un seul appel.
 *
 * N'envoie réellement que si RESEND_API_KEY est défini en variable
 * d'environnement (Railway, service API) — sinon `estConfigure()` renvoie
 * faux et l'appelant doit retomber sur l'escalade admin plutôt que de
 * prétendre avoir envoyé un email qui ne partira jamais.
 */
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);

  estConfigure(): boolean {
    return Boolean(process.env.RESEND_API_KEY);
  }

  /**
   * @returns true si Resend a accepté l'envoi (ne garantit pas la
   * délivrance réelle, seulement que l'API a répondu 2xx).
   */
  async envoyer(destinataire: string, sujet: string, texte: string): Promise<boolean> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return false;

    const expediteur = process.env.RESEND_FROM_EMAIL ?? "ELEGANZ <onboarding@resend.dev>";

    try {
      const reponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: expediteur,
          to: [destinataire],
          subject: sujet,
          text: texte,
        }),
      });
      if (!reponse.ok) {
        this.logger.error(`Resend a refusé l'envoi (${reponse.status}): ${await reponse.text()}`);
        return false;
      }
      return true;
    } catch (err) {
      this.logger.error(`Échec d'envoi email via Resend: ${err instanceof Error ? err.message : err}`);
      return false;
    }
  }
}
