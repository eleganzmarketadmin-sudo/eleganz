import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { NotificationType } from "@eleganz/database";

type EtatEcheance = "AVANT" | "JOUR" | "RETARD";

// Fenêtre de relance avant échéance (demande UX du 15 oct. 2026, point 8).
const JOURS_RELANCE_AVANT = 3;

function etatEcheance(dueDate: Date, maintenant: Date): EtatEcheance | null {
  const jourDue = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const jourNow = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const diffJours = Math.round((jourDue.getTime() - jourNow.getTime()) / (1000 * 60 * 60 * 24));
  if (diffJours > JOURS_RELANCE_AVANT) return null; // trop loin, pas encore concerné
  if (diffJours > 0) return "AVANT";
  if (diffJours === 0) return "JOUR";
  return "RETARD";
}

const LIBELLE_ETAT: Record<EtatEcheance, string> = {
  AVANT: "arrive bientôt à échéance",
  JOUR: "arrive à échéance aujourd'hui",
  RETARD: "est en retard de paiement",
};

/**
 * Échéancier avec relances (demande UX du 15 oct. 2026, point 8) : "tenir un
 * échéancier avec des relances avant échéance, à échéance, et les notif
 * post échéance en cas de retard de paiement constaté dans la plateforme,
 * que les acteurs (gestion, comptable) vont recevoir dans leur messagerie et
 * sous forme de notification."
 *
 * Couvre les échéances déjà suivies dans le moteur Secourable
 * (ComptableDebt, ComptableRentPayment, ComptableWorkerRemittance) et côté
 * Gestion (achats fournisseur à crédit, `Purchase.onCredit`). Jamais une
 * échéance inventée : seules des lignes déjà saisies par l'utilisateur,
 * avec une date d'échéance renseignée et un solde non réglé, déclenchent
 * une relance.
 *
 * Pas encore branché sur un vrai planificateur (même limite que
 * BillingService.processTrialExpirations — voir son TODO) : exécuté pour
 * l'instant à la demande via POST /admin/echeancier/run. Chaque exécution
 * renvoie une notification pour chaque ligne encore dans sa fenêtre de
 * relance (J-3 à J+∞) ; destiné à tourner une fois par jour, pas plusieurs
 * fois dans la même journée, pour ne pas créer de doublons.
 */
@Injectable()
export class EcheancierService {
  private readonly logger = new Logger(EcheancierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async run() {
    const maintenant = new Date();
    const resultats = {
      dettes: 0,
      loyers: 0,
      versements: 0,
      achatsFournisseur: 0,
      facturesBoutiques: 0,
      facturesLivreurs: 0,
      facturesComptable: 0,
    };

    resultats.dettes = await this.relancerDettesComptable(maintenant);
    resultats.loyers = await this.relancerLoyers(maintenant);
    resultats.versements = await this.relancerVersements(maintenant);
    resultats.achatsFournisseur = await this.relancerAchatsFournisseur(maintenant);
    // Ajout du 18 oct. 2026 (automatisation du cycle de facturation, point 6
    // de l'audit) : avant chaque suspension pour impayé (BillingService,
    // DriverBillingService, ComptableBillingService), la boutique/le
    // livreur/le compte comptable doit avoir reçu une relance — même
    // fenêtre J-3→retard que les échéances déjà couvertes ci-dessus.
    resultats.facturesBoutiques = await this.relancerFacturesBoutiques(maintenant);
    resultats.facturesLivreurs = await this.relancerFacturesLivreurs(maintenant);
    resultats.facturesComptable = await this.relancerFacturesComptable(maintenant);

    this.logger.log(`Échéancier exécuté : ${JSON.stringify(resultats)}`);
    return resultats;
  }

  private async relancerDettesComptable(maintenant: Date): Promise<number> {
    const dettes = await this.prisma.comptableDebt.findMany({
      where: { settled: false, dueDate: { not: null } },
      include: { activity: { select: { userId: true, name: true } }, payments: true },
    });

    let nombre = 0;
    for (const dette of dettes) {
      const etat = etatEcheance(dette.dueDate!, maintenant);
      if (!etat) continue;
      const paye = dette.payments.reduce((s, p) => s + Number(p.amount), 0);
      const reste = Number(dette.amount) - paye;
      if (reste <= 0) continue;

      const sens = dette.type === "CREANCE" ? "à recevoir de" : "à payer à";
      await this.notifications.notifierUtilisateurs([dette.activity.userId], {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Échéance en retard" : "Échéance à venir",
        body: `${dette.activity.name} : ${sens} ${dette.counterpartyName} ${LIBELLE_ETAT[etat]} (${reste.toFixed(2)} ${dette.currency}).`,
        link: "/comptable",
      });
      nombre += 1;
    }
    return nombre;
  }

  private async relancerLoyers(maintenant: Date): Promise<number> {
    const loyers = await this.prisma.comptableRentPayment.findMany({
      where: { paidAt: null },
      include: { unit: { select: { activity: { select: { userId: true } }, label: true } } },
    });

    let nombre = 0;
    for (const loyer of loyers) {
      const etat = etatEcheance(loyer.dueDate, maintenant);
      if (!etat) continue;
      if (Number(loyer.receivedAmount) >= Number(loyer.expectedAmount)) continue;

      await this.notifications.notifierUtilisateurs([loyer.unit.activity.userId], {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Loyer en retard" : "Loyer à venir",
        body: `Loyer de ${loyer.unit.label} (${loyer.periodLabel}) ${LIBELLE_ETAT[etat]}.`,
        link: "/comptable/activites",
      });
      nombre += 1;
    }
    return nombre;
  }

  private async relancerVersements(maintenant: Date): Promise<number> {
    const versements = await this.prisma.comptableWorkerRemittance.findMany({
      where: { settledAt: null, dueDate: { not: null } },
      include: { activity: { select: { userId: true, name: true } } },
    });

    let nombre = 0;
    for (const versement of versements) {
      const etat = etatEcheance(versement.dueDate!, maintenant);
      if (!etat) continue;

      await this.notifications.notifierUtilisateurs([versement.activity.userId], {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Versement en retard" : "Versement à venir",
        body: `${versement.activity.name} : le versement de ${versement.workerName} (${versement.periodLabel}) ${LIBELLE_ETAT[etat]}.`,
        link: "/comptable/activites",
      });
      nombre += 1;
    }
    return nombre;
  }

  private async relancerAchatsFournisseur(maintenant: Date): Promise<number> {
    const achats = await this.prisma.purchase.findMany({
      where: { onCredit: true, dueDate: { not: null } },
      include: {
        supplier: {
          select: {
            name: true,
            shop: {
              select: { ownerId: true, name: true, staff: { where: { active: true }, select: { userId: true } } },
            },
          },
        },
        reglements: true,
      },
    });

    let nombre = 0;
    for (const achat of achats) {
      const etat = etatEcheance(achat.dueDate!, maintenant);
      if (!etat) continue;
      const regle = achat.reglements.reduce((s, r) => s + Number(r.amount), 0);
      const reste = Number(achat.amount) - regle;
      if (reste <= 0) continue;

      const shop = achat.supplier.shop;

      const destinataires = [shop.ownerId, ...shop.staff.map((s) => s.userId)];
      await this.notifications.notifierUtilisateurs(destinataires, {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Dette fournisseur en retard" : "Dette fournisseur à venir",
        body: `${shop.name} : la dette envers ${achat.supplier.name} ${LIBELLE_ETAT[etat]} (${reste.toFixed(2)}).`,
        link: "/finance",
      });
      nombre += 1;
    }
    return nombre;
  }

  /**
   * Factures d'abonnement/commission boutique (BillingService) — relance
   * avant que `BillingService.suspendOverdueShops` (grâce de 7 jours après
   * `dueAt`) ne suspende effectivement l'accès (18 oct. 2026, point 6).
   * Destinataires : propriétaire + staff actif, comme pour les dettes
   * fournisseur ci-dessus.
   */
  private async relancerFacturesBoutiques(maintenant: Date): Promise<number> {
    const factures = await this.prisma.invoice.findMany({
      where: { status: "PENDING" },
      include: { shop: { select: { ownerId: true, name: true, staff: { where: { active: true }, select: { userId: true } } } } },
    });

    let nombre = 0;
    for (const facture of factures) {
      const etat = etatEcheance(facture.dueAt, maintenant);
      if (!etat) continue;

      const destinataires = [facture.shop.ownerId, ...facture.shop.staff.map((s) => s.userId)];
      await this.notifications.notifierUtilisateurs(destinataires, {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Facture ELEGANZ en retard" : "Facture ELEGANZ à venir",
        body:
          etat === "RETARD"
            ? `${facture.shop.name} : une facture (${Number(facture.amount).toFixed(2)}) est en retard — la boutique sera suspendue si elle reste impayée.`
            : `${facture.shop.name} : une facture (${Number(facture.amount).toFixed(2)}) ${LIBELLE_ETAT[etat]}.`,
        link: "/parametres",
      });
      nombre += 1;
    }
    return nombre;
  }

  /**
   * Factures livreur (DriverBillingService) — même logique, avant
   * `DriverBillingService.suspendOverdueDrivers`.
   */
  private async relancerFacturesLivreurs(maintenant: Date): Promise<number> {
    const factures = await this.prisma.driverInvoice.findMany({
      where: { status: "PENDING" },
      include: { driver: { select: { userId: true } } },
    });

    let nombre = 0;
    for (const facture of factures) {
      const etat = etatEcheance(facture.dueAt, maintenant);
      if (!etat) continue;

      await this.notifications.notifierUtilisateurs([facture.driver.userId], {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Facture livreur en retard" : "Facture livreur à venir",
        body:
          etat === "RETARD"
            ? `Votre facture (${Number(facture.amount).toFixed(2)}) est en retard — votre compte sera suspendu si elle reste impayée.`
            : `Votre facture (${Number(facture.amount).toFixed(2)}) ${LIBELLE_ETAT[etat]}.`,
        link: "/livreur/profil",
      });
      nombre += 1;
    }
    return nombre;
  }

  /**
   * Factures ELEGANZ Mon Comptable (ComptableBillingService) — même
   * logique, avant `ComptableBillingService.suspendOverdueSubscriptions`.
   */
  private async relancerFacturesComptable(maintenant: Date): Promise<number> {
    const factures = await this.prisma.comptableInvoice.findMany({
      where: { status: "PENDING" },
      include: { subscription: { select: { userId: true } } },
    });

    let nombre = 0;
    for (const facture of factures) {
      const etat = etatEcheance(facture.dueAt, maintenant);
      if (!etat) continue;

      await this.notifications.notifierUtilisateurs([facture.subscription.userId], {
        type: etat === "RETARD" ? NotificationType.ECHEANCE_DEPASSEE : NotificationType.ECHEANCE_A_VENIR,
        title: etat === "RETARD" ? "Facture Mon Comptable en retard" : "Facture Mon Comptable à venir",
        body:
          etat === "RETARD"
            ? `Votre facture (${Number(facture.amount).toFixed(2)}) est en retard — votre abonnement sera suspendu si elle reste impayée.`
            : `Votre facture (${Number(facture.amount).toFixed(2)}) ${LIBELLE_ETAT[etat]}.`,
        link: "/comptable",
      });
      nombre += 1;
    }
    return nombre;
  }
}
