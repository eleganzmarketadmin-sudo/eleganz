import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationChannel, NotificationType } from "@eleganz/database";
import { PushSenderService } from "../push/push-sender.service";
import { PushSubscriptionsService } from "../push/push-subscriptions.service";
import { EmailSenderService } from "./channels/email-sender.service";
import { SmsSenderService } from "./channels/sms-sender.service";
import { WhatsAppSenderService } from "./channels/whatsapp-sender.service";

// Notifications pertinentes pour l'espace livreur (20 nov. 2026, retour
// client : un livreur voyait "nouvelle commande reçue" d'une boutique —
// COMMANDE_RECUE, LIVREUR_DEMANDE_REPONDUE et LIVRAISON_ETAPE_MISE_A_JOUR
// sont écrites pour la boutique/l'acheteur, jamais pour le livreur lui-même,
// mais s'affichaient quand même sur son portail si ce même compte est par
// ailleurs membre du personnel d'une boutique — la cloche n'a jusqu'ici
// jamais filtré par espace). Volontairement restreint à l'espace livreur
// seul : gestion/comptable/admin/institution continuent de tout voir
// exactement comme avant, aucun changement de comportement pour eux.
const TYPES_ESPACE_LIVREUR: NotificationType[] = [
  NotificationType.NOUVEAU_MESSAGE,
  NotificationType.FACTURE_RELANCE,
  NotificationType.FACTURE_SUSPENDUE,
  NotificationType.PAIEMENT_RECU,
  NotificationType.REACTIVATION_DEMANDE,
  NotificationType.LIVREUR_DEMANDE_RECUE,
  NotificationType.LIVRAISON_ASSIGNEE,
  NotificationType.AUTRE,
];

function filtreTypeParEspace(espace?: string): { type?: { in: NotificationType[] } } {
  if (espace === "livreur") return { type: { in: TYPES_ESPACE_LIVREUR } };
  return {};
}

/**
 * Notifications in-app (15 oct. 2026, demande UX point 7) — fondation
 * transverse : n'importe quel service de la plateforme peut appeler
 * `notifierUtilisateurs` sans se soucier des canaux, ce service est le
 * seul point qui consulte PlatformSettings pour savoir s'il doit
 * effectivement écrire la ligne (et sur quel canal). Email et SMS restent
 * de simples interrupteurs non câblés tant qu'aucun fournisseur d'envoi
 * n'est branché (voir schema.prisma, PlatformSettings) : les activer ne
 * fait aujourd'hui rien de plus que l'in-app, par choix explicite plutôt
 * que d'écrire une ligne "channel: EMAIL" qui ne serait jamais envoyée.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSender: PushSenderService,
    private readonly pushSubscriptions: PushSubscriptionsService,
    private readonly email: EmailSenderService,
    private readonly sms: SmsSenderService,
    private readonly whatsapp: WhatsAppSenderService,
  ) {}

  async notifierUtilisateurs(
    userIds: string[],
    params: { type: NotificationType; title: string; body: string; link?: string },
  ): Promise<{ inApp: boolean; push: boolean }> {
    // Correctif audit du 18 oct. 2026 : un tableau vide (ex. zéro compte
    // ADMIN_* trouvé pour une escalade — voir
    // PasswordResetService.demanderReinitialisation) faisait disparaître la
    // notification sans aucune trace, alors que l'appelant peut avoir déjà
    // dit à la personne « votre demande a été transmise ». Ce marqueur
    // greppable (NOTIFICATION_DESTINATAIRES_VIDE) rend ce cas repérable
    // dans les logs sans changer le comportement (toujours un no-op, qui
    // reste le bon choix générique pour un primitif partagé par une
    // douzaine d'appelants).
    if (userIds.length === 0) {
      this.logger.warn(`NOTIFICATION_DESTINATAIRES_VIDE aucun destinataire pour la notification "${params.title}"`);
      return { inApp: false, push: false };
    }
    const uniques = [...new Set(userIds)];

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: { notificationsInAppEnabled: true, notificationsPushEnabled: true },
    });
    // Pas de ligne par défaut tant qu'un admin n'a jamais configuré
    // PlatformSettings — on considère l'in-app actif par défaut (valeur de
    // repli de la colonne elle-même), jamais l'inverse : un utilisateur ne
    // doit pas perdre silencieusement ses notifications faute de réglage.
    if (settings && !settings.notificationsInAppEnabled) return { inApp: false, push: false };

    await this.prisma.notification.createMany({
      data: uniques.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
      })),
    });

    // Notifications push (10 nov. 2026) : même logique de repli que
    // notificationsInAppEnabled ci-dessus (actif par défaut tant qu'aucun
    // admin n'a explicitement coupé), ET le canal doit être réellement
    // câblé (clés VAPID présentes) — voir PushSenderService.estConfigure().
    // Ne bloque jamais la création de la notification in-app ci-dessus :
    // lancé après, sans attendre la fin de l'envoi (l'appelant a déjà ce
    // qu'il attend de cette méthode une fois la ligne en base écrite).
    const pushActif = (!settings || settings.notificationsPushEnabled) && this.pushSender.estConfigure();
    if (pushActif) {
      this.envoyerPushEnArrierePlan(uniques, params).catch((err) => {
        this.logger.error(`Échec du relais push: ${err instanceof Error ? err.message : err}`);
      });
    }
    return { inApp: true, push: pushActif };
  }

  private async envoyerPushEnArrierePlan(
    userIds: string[],
    params: { title: string; body: string; link?: string },
  ) {
    const abonnements = await this.pushSubscriptions.pourUtilisateurs(userIds);
    const resultats = await Promise.allSettled(
      abonnements.map(async (abonnement) => {
        const resultat = await this.pushSender.envoyer(abonnement, {
          title: params.title,
          body: params.body,
          link: params.link,
        });
        if (resultat === "expiree") {
          await this.pushSubscriptions.supprimerExpiree(abonnement.endpoint);
        }
      }),
    );
    const echecs = resultats.filter((r) => r.status === "rejected").length;
    if (echecs > 0) {
      this.logger.warn(`${echecs}/${abonnements.length} envoi(s) push en échec pour "${params.title}"`);
    }
  }

  /**
   * Variante de `notifierUtilisateurs` qui fait AUSSI partir le message par
   * email/SMS/WhatsApp (16 nov. 2026, chantier relances/recouvrement de
   * facturation — décision explicite du propriétaire d'élargir les canaux
   * de relance au-delà de l'in-app+push). Réservée aux relances de
   * facturation (BillingService/DriverBillingService/
   * ComptableBillingService) : le reste de la plateforme continue d'appeler
   * `notifierUtilisateurs` et reste in-app+push uniquement, par choix
   * assumé (pas de bascule générale sans décision explicite).
   *
   * Chaque canal externe est gardé par le même double verrou que
   * `notifierUtilisateurs` applique déjà au push : l'interrupteur
   * PlatformSettings correspondant ET `estConfigure()` (clé d'API présente
   * côté serveur) — jamais l'un sans l'autre, pour ne jamais prétendre
   * avoir envoyé un message qui ne partira nulle part.
   *
   * Renvoie la liste des canaux actifs pour cet envoi (ex.
   * `["IN_APP","PUSH","EMAIL"]`) — correctif du 19 nov. 2026 (audit de
   * bout en bout) : seul appelant qui en a besoin aujourd'hui,
   * `BillingService.appliquerEtapeRelance` (et ses miroirs
   * Driver/Comptable), pour renseigner enfin `InvoiceReminder.canaux`,
   * resté vide depuis l'implémentation initiale malgré le besoin de
   * diagnostic documenté dans le plan ("pourquoi une relance n'est jamais
   * arrivée par SMS/WhatsApp"). Les autres appelants ignorent la valeur de
   * retour sans risque (void implicite jusqu'ici).
   */
  async notifierMulticanal(
    userIds: string[],
    params: { type: NotificationType; title: string; body: string; link?: string },
  ): Promise<string[]> {
    const { inApp, push } = await this.notifierUtilisateurs(userIds, params);
    const canaux: string[] = [];
    if (inApp) canaux.push("IN_APP");
    if (push) canaux.push("PUSH");
    if (userIds.length === 0) return canaux;

    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: { notificationsEmailEnabled: true, notificationsSmsEnabled: true, notificationsWhatsappEnabled: true },
    });
    const emailActif = Boolean(settings?.notificationsEmailEnabled) && this.email.estConfigure();
    const smsActif = Boolean(settings?.notificationsSmsEnabled) && this.sms.estConfigure();
    const whatsappActif = Boolean(settings?.notificationsWhatsappEnabled) && this.whatsapp.estConfigure();
    if (emailActif) canaux.push("EMAIL");
    if (smsActif) canaux.push("SMS");
    if (whatsappActif) canaux.push("WHATSAPP");
    if (!emailActif && !smsActif && !whatsappActif) return canaux;

    const uniques = [...new Set(userIds)];
    const utilisateurs = await this.prisma.user.findMany({
      where: { id: { in: uniques } },
      select: { id: true, email: true, phone: true },
    });

    const envois: Promise<void>[] = [];
    for (const u of utilisateurs) {
      if (emailActif && u.email) {
        envois.push(
          this.email
            .envoyer(u.email, params.title, params.body)
            .then((ok) => this.tracerEnvoiCanal(u.id, params, NotificationChannel.EMAIL, ok)),
        );
      }
      const texteCourt = `${params.title} — ${params.body}`;
      if (smsActif && u.phone) {
        envois.push(
          this.sms.envoyer(u.phone, texteCourt).then((ok) => this.tracerEnvoiCanal(u.id, params, NotificationChannel.SMS, ok)),
        );
      }
      if (whatsappActif && u.phone) {
        envois.push(
          this.whatsapp
            .envoyer(u.phone, texteCourt)
            .then((ok) => this.tracerEnvoiCanal(u.id, params, NotificationChannel.WHATSAPP, ok)),
        );
      }
    }
    const resultats = await Promise.allSettled(envois);
    const echecs = resultats.filter((r) => r.status === "rejected").length;
    if (echecs > 0) {
      this.logger.warn(`${echecs}/${envois.length} envoi(s) multicanal en échec pour "${params.title}"`);
    }
    return canaux;
  }

  // Correctif du 19 nov. 2026 (audit de bout en bout) : cette méthode
  // écrivait jusqu'ici une ligne Notification (channel: EMAIL/SMS/WHATSAPP)
  // supplémentaire PAR CANAL réussi, en plus de la ligne in-app déjà créée
  // par notifierUtilisateurs — alors que `Notification` est la table que
  // lit directement NotificationBell.tsx (liste + compteur non lues) sans
  // jamais filtrer ni dédupliquer par `channel`. Résultat concret pour
  // l'utilisateur : le même événement de relance apparaissait 2 à 4 fois
  // dans sa cloche de notifications (une fois par canal actif), et le
  // badge de non-lues était inflé d'autant — alors qu'aucun écran admin ne
  // lit jamais `Notification.channel` (seul `InvoiceReminder.canaux`, voir
  // ci-dessus, sert ce besoin de diagnostic). On se contente donc
  // désormais de journaliser l'échec, sans ligne Notification dupliquée.
  private tracerEnvoiCanal(
    userId: string,
    params: { type: NotificationType; title: string; body: string; link?: string },
    canal: NotificationChannel,
    envoye: boolean,
  ) {
    if (!envoye) {
      this.logger.warn(`Échec d'envoi ${canal} pour l'utilisateur ${userId} ("${params.title}")`);
    }
  }

  list(userId: string, options: { nonLuesSeulement?: boolean; espace?: string } = {}) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        ...(options.nonLuesSeulement ? { readAt: null } : {}),
        ...filtreTypeParEspace(options.espace),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async compterNonLues(userId: string, espace?: string) {
    return this.prisma.notification.count({
      where: { userId, readAt: null, ...filtreTypeParEspace(espace) },
    });
  }

  async marquerLue(userId: string, id: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id } });
    if (notification.userId !== userId) {
      throw new ForbiddenException("Cette notification ne vous appartient pas.");
    }
    return this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  }

  marquerToutesLues(userId: string, espace?: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...filtreTypeParEspace(espace) },
      data: { readAt: new Date() },
    });
  }
}
