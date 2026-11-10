import { Injectable, Logger } from "@nestjs/common";
// Import CommonJS correct même sans `esModuleInterop` — même piège déjà
// rencontré avec pdfkit (voir documents/pdf-renderer.ts) : `import webpush
// from "web-push"` compile en `require("web-push").default`, qui n'existe
// pas sur ce module CommonJS classique, et plante au runtime.
import webpush = require("web-push");

export interface ChargePush {
  title: string;
  body: string;
  link?: string;
}

export interface AbonnementPourEnvoi {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Envoi de notifications push navigateur (Web Push/VAPID) — demande du 10
 * nov. 2026 : alerter la personne sur son téléphone/ordinateur à l'arrivée
 * d'un message ou d'une commande, avec redirection au clic vers la
 * plateforme. Même principe que SmsSenderService/WhatsAppSenderService :
 * `estConfigure()` dit honnêtement si le canal est utilisable avant toute
 * tentative — ici, tant que VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY (une paire de
 * clés à usage unique pour ce site, sans compte ni service tiers à payer)
 * ne sont pas définies dans l'environnement du serveur, ce canal reste
 * simplement inactif.
 */
@Injectable()
export class PushSenderService {
  private readonly logger = new Logger(PushSenderService.name);
  private configuree = false;

  constructor() {
    const clePublique = process.env.VAPID_PUBLIC_KEY;
    const clePrivee = process.env.VAPID_PRIVATE_KEY;
    if (clePublique && clePrivee) {
      // Le "sujet" (mailto:) est exigé par la spec VAPID pour que les
      // fournisseurs (Chrome/Firefox push services) puissent recontacter
      // l'exploitant en cas d'abus — jamais visible par l'utilisateur final.
      const sujet = process.env.VAPID_CONTACT_EMAIL
        ? `mailto:${process.env.VAPID_CONTACT_EMAIL}`
        : "mailto:contact@eleganzmarket.com";
      webpush.setVapidDetails(sujet, clePublique, clePrivee);
      this.configuree = true;
    }
  }

  estConfigure(): boolean {
    return this.configuree;
  }

  clePublique(): string | null {
    return this.configuree ? (process.env.VAPID_PUBLIC_KEY ?? null) : null;
  }

  /**
   * Retourne "expiree" quand le navigateur confirme que cet abonnement
   * n'est plus valable (404/410 — désinstallation, permission retirée,
   * endpoint périmé) : l'appelant doit alors supprimer la ligne en base
   * pour ne pas réessayer indéfiniment un envoi mort. "echec" couvre tout
   * le reste (panne passagère du service push, etc.) — pas d'action sur la
   * ligne, un futur envoi retentera normalement.
   */
  async envoyer(abonnement: AbonnementPourEnvoi, charge: ChargePush): Promise<"ok" | "expiree" | "echec"> {
    if (!this.configuree) return "echec";
    try {
      await webpush.sendNotification(
        { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
        JSON.stringify(charge),
      );
      return "ok";
    } catch (err) {
      const statut = (err as { statusCode?: number } | undefined)?.statusCode;
      if (statut === 404 || statut === 410) return "expiree";
      this.logger.error(`Échec d'envoi push: ${err instanceof Error ? err.message : err}`);
      return "echec";
    }
  }
}
