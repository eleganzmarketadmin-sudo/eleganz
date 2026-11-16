import { Prisma } from "@eleganz/database";

/**
 * Relances numérotées + pénalités de retard — boutiques, livreurs ET
 * comptable/Secourable (16 nov. 2026, chantier relances/recouvrement,
 * généralisé aux trois domaines sur demande explicite du propriétaire).
 *
 * Fonctions pures, sans dépendance Prisma/NestJS, partagées par
 * BillingService/DriverBillingService/ComptableBillingService — chacun
 * garde sa propre méthode d'escalade qui les appelle sur son propre modèle
 * de facture, exactement comme chacun a déjà sa propre méthode de
 * suspension aujourd'hui. Voir le commentaire sur Invoice.reminderStage
 * dans schema.prisma pour la signification des paliers 0..5.
 */

export interface SeuilsFacturation {
  invoiceLatePenaltyRatePercent: Prisma.Decimal | null;
  invoicePenaltyGraceDays: number;
  reminderDay1Offset: number;
  reminderDay2Offset: number;
  reminderDay3Offset: number;
  warningDayOffset: number;
  suspensionDayOffset: number;
}

/**
 * Différence en JOURS CALENDAIRES (pas en heures d'horloge) entre deux
 * dates — même convention que `etatEcheance` dans EcheancierService
 * (tronque à minuit avant de diviser), pour que les deux moteurs comptent
 * les jours de retard de façon identique et qu'une migration future de
 * l'un vers l'autre ne change jamais un résultat déjà observé.
 */
export function joursEntiersEntre(depuis: Date, jusqua: Date): number {
  const jourDepuis = new Date(depuis.getFullYear(), depuis.getMonth(), depuis.getDate());
  const jourJusqua = new Date(jusqua.getFullYear(), jusqua.getMonth(), jusqua.getDate());
  return Math.round((jourJusqua.getTime() - jourDepuis.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Palier de relance cible pour un nombre de jours écoulés depuis
 * l'échéance (peut être négatif, avant échéance : renvoie alors 0).
 * L'appelant ne doit RÉ-AGIR (envoyer une relance / suspendre) que si ce
 * palier dépasse celui déjà atteint (`*.reminderStage` en base) — c'est ce
 * qui évite qu'une relance soit renvoyée chaque jour une fois le palier
 * atteint, contrairement à l'ancien comportement de
 * `EcheancierService.relancerFactures{Boutiques,Livreurs,Comptable}`.
 */
export function palierCible(joursDepuisEcheance: number, reglages: SeuilsFacturation): number {
  if (joursDepuisEcheance >= reglages.suspensionDayOffset) return 5; // notification de suspension
  if (joursDepuisEcheance >= reglages.warningDayOffset) return 4; // avertissement de suspension imminente
  if (joursDepuisEcheance >= reglages.reminderDay3Offset) return 3; // 3e relance
  if (joursDepuisEcheance >= reglages.reminderDay2Offset) return 2; // 2e relance
  if (joursDepuisEcheance >= reglages.reminderDay1Offset) return 1; // 1re relance
  return 0;
}

/**
 * Formule de pénalité de retard — exemple donné par le propriétaire : un
 * paiement au 10e jour après l'échéance, avec une franchise de 5 jours,
 * porte une pénalité calculée sur 5 jours (10 - 5 = 5). Volontairement une
 * fonction PURE qui ne lit jamais le statut de l'entité (boutique/
 * livreur/comptable) : elle ne sait pas si l'entité a été suspendue entre
 * l'échéance et le paiement, donc la même formule s'applique
 * mécaniquement qu'une facture soit payée avant ou après suspension —
 * exigence explicite du propriétaire, garantie par construction plutôt que
 * par un cas particulier qu'il faudrait écrire et tester séparément.
 */
export function calculerPenaliteRetard(
  montant: Prisma.Decimal | number,
  dueAt: Date,
  paidAt: Date,
  reglages: Pick<SeuilsFacturation, "invoicePenaltyGraceDays" | "invoiceLatePenaltyRatePercent">,
): { penaltyDays: number; penaltyAmount: number } {
  const joursEcoules = joursEntiersEntre(dueAt, paidAt);
  const penaltyDays = Math.max(0, joursEcoules - reglages.invoicePenaltyGraceDays);
  const taux = reglages.invoiceLatePenaltyRatePercent;
  if (penaltyDays === 0 || !taux) return { penaltyDays, penaltyAmount: 0 };
  const montantNombre = typeof montant === "number" ? montant : Number(montant);
  const penaltyAmount = Math.round(montantNombre * (Number(taux) / 100) * penaltyDays * 100) / 100;
  return { penaltyDays, penaltyAmount };
}

/**
 * Valide qu'un jeu de seuils reste strictement croissant
 * (1re relance < 2e < 3e < avertissement < suspension) — appelée par
 * AdminSettingsService.update() avant d'écrire une mise à jour de
 * PlatformSettings, pour qu'un admin ne puisse pas enregistrer par erreur
 * un calendrier incohérent (ex. suspension avant la 3e relance). Renvoie
 * un message d'erreur en français si incohérent, sinon null.
 */
export function validerSeuilsCroissants(reglages: SeuilsFacturation): string | null {
  const paliers: [string, number][] = [
    ["reminderDay1Offset", reglages.reminderDay1Offset],
    ["reminderDay2Offset", reglages.reminderDay2Offset],
    ["reminderDay3Offset", reglages.reminderDay3Offset],
    ["warningDayOffset", reglages.warningDayOffset],
    ["suspensionDayOffset", reglages.suspensionDayOffset],
  ];
  for (let i = 1; i < paliers.length; i++) {
    if (paliers[i][1] <= paliers[i - 1][1]) {
      return `Les paliers de relance doivent être strictement croissants : ${paliers[i - 1][0]} (${paliers[i - 1][1]}) doit être inférieur à ${paliers[i][0]} (${paliers[i][1]}).`;
    }
  }
  return null;
}

/** Libellés français des paliers 1..5 — réutilisés par les trois services d'escalade pour le titre/corps des notifications. */
export const TITRE_PALIER: Record<number, string> = {
  1: "1re relance de facturation",
  2: "2e relance de facturation",
  3: "3e relance de facturation",
  4: "Avertissement de suspension imminente",
  5: "Suspension pour impayé",
};
