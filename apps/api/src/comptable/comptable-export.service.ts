import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { construireClasseurExcel } from "../common/xlsx.util";

export interface SyntheseActivite {
  activityId: string;
  activityName: string;
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

export interface SynthesePeriode {
  userId: string;
  from: string;
  to: string;
  activites: SyntheseActivite[];
  totalVentesCdf: number;
  totalVentesUsd: number;
  totalDepensesCdf: number;
  totalDepensesUsd: number;
  nombreOperations: number;
  genereLe: string;
  codeVerification: string;
}

export interface MoisDossier {
  mois: string; // ex. "2026-08"
  label: string; // ex. "Août 2026"
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

export interface DossierFinancement {
  userId: string;
  nomUtilisateur: string;
  activites: { id: string; name: string; category: string; creeeLe: string }[];
  historiqueMensuel: MoisDossier[];
  dettesOuvertes: { type: string; counterpartyName: string; amount: number; currency: string; solde: number }[];
  creancesOuvertes: { counterpartyName: string; amount: number; currency: string; solde: number }[];
  genereLe: string;
  codeVerification: string;
}

/**
 * Synthèses périodiques et dossier de financement pour ELEGANZ Mon
 * Comptable (prompt §10.5 et §15). "Code de vérification" ici est une
 * empreinte des totaux calculés côté serveur, horodatée — un repère pour
 * détecter une modification du document après coup, PAS une certification
 * comptable ou fiscale au sens légal (même convention que les relevés
 * boutique, reports.service.ts).
 */
@Injectable()
export class ComptableExportService {
  constructor(private readonly prisma: PrismaService) {}

  private coderVerification(valeurs: (string | number)[]): string {
    return createHash("sha256").update(valeurs.join("|")).digest("hex").slice(0, 12).toUpperCase();
  }

  async synthesePeriode(userId: string, from: Date, to: Date): Promise<SynthesePeriode> {
    if (from >= to) throw new BadRequestException("La date de fin doit être postérieure à la date de début.");

    const activites = await this.prisma.comptableActivity.findMany({ where: { userId } });
    const activityIds = activites.map((a) => a.id);
    const entries = await this.prisma.comptableEntry.findMany({
      where: { activityId: { in: activityIds }, date: { gte: from, lt: to } },
    });

    const parActivite: SyntheseActivite[] = activites.map((a) => {
      const lesSiennes = entries.filter((e) => e.activityId === a.id);
      const somme = (direction: "ENTREE" | "SORTIE", currency: "CDF" | "USD") =>
        lesSiennes.filter((e) => e.direction === direction && e.currency === currency).reduce((s, e) => s + Number(e.amount), 0);
      return {
        activityId: a.id,
        activityName: a.name,
        ventesCdf: somme("ENTREE", "CDF"),
        ventesUsd: somme("ENTREE", "USD"),
        depensesCdf: somme("SORTIE", "CDF"),
        depensesUsd: somme("SORTIE", "USD"),
      };
    });

    const totaux = {
      totalVentesCdf: parActivite.reduce((s, a) => s + a.ventesCdf, 0),
      totalVentesUsd: parActivite.reduce((s, a) => s + a.ventesUsd, 0),
      totalDepensesCdf: parActivite.reduce((s, a) => s + a.depensesCdf, 0),
      totalDepensesUsd: parActivite.reduce((s, a) => s + a.depensesUsd, 0),
    };
    const genereLe = new Date().toISOString();
    const codeVerification = this.coderVerification([
      userId,
      from.toISOString(),
      to.toISOString(),
      totaux.totalVentesCdf,
      totaux.totalVentesUsd,
      totaux.totalDepensesCdf,
      totaux.totalDepensesUsd,
      entries.length,
    ]);

    return {
      userId,
      from: from.toISOString(),
      to: to.toISOString(),
      activites: parActivite,
      ...totaux,
      nombreOperations: entries.length,
      genereLe,
      codeVerification,
    };
  }

  exporterSyntheseExcel(synthese: SynthesePeriode): Promise<Buffer> {
    const entetes = ["Activité", "Ventes CDF", "Ventes USD", "Dépenses CDF", "Dépenses USD", "Résultat CDF", "Résultat USD"];
    const lignes = synthese.activites.map((a) => [
      a.activityName,
      a.ventesCdf,
      a.ventesUsd,
      a.depensesCdf,
      a.depensesUsd,
      a.ventesCdf - a.depensesCdf,
      a.ventesUsd - a.depensesUsd,
    ]);
    lignes.push([
      "TOTAL",
      synthese.totalVentesCdf,
      synthese.totalVentesUsd,
      synthese.totalDepensesCdf,
      synthese.totalDepensesUsd,
      synthese.totalVentesCdf - synthese.totalDepensesCdf,
      synthese.totalVentesUsd - synthese.totalDepensesUsd,
    ]);
    return construireClasseurExcel("Synthèse ELEGANZ Mon assistant", entetes, lignes);
  }

  /**
   * Dossier préparatoire pour demande de financement (prompt §15) — jamais
   * présenté comme un état financier certifié : le renderer PDF porte un
   * bandeau d'avertissement explicite en tête de document.
   */
  async dossierFinancement(userId: string, moisHistorique = 6): Promise<DossierFinancement> {
    const utilisateur = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });
    const nomUtilisateur = utilisateur?.fullName || utilisateur?.email || "Compte ELEGANZ";
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
    const activityIds = activites.map((a) => a.id);

    const debut = new Date();
    debut.setDate(1);
    debut.setHours(0, 0, 0, 0);
    debut.setMonth(debut.getMonth() - (moisHistorique - 1));

    const entries = await this.prisma.comptableEntry.findMany({
      where: { activityId: { in: activityIds }, date: { gte: debut } },
    });

    const historiqueMensuel: MoisDossier[] = [];
    for (let i = 0; i < moisHistorique; i++) {
      const moisDebut = new Date(debut.getFullYear(), debut.getMonth() + i, 1);
      const moisFin = new Date(debut.getFullYear(), debut.getMonth() + i + 1, 1);
      const duMois = entries.filter((e) => e.date >= moisDebut && e.date < moisFin);
      const somme = (direction: "ENTREE" | "SORTIE", currency: "CDF" | "USD") =>
        duMois.filter((e) => e.direction === direction && e.currency === currency).reduce((s, e) => s + Number(e.amount), 0);
      historiqueMensuel.push({
        mois: `${moisDebut.getFullYear()}-${String(moisDebut.getMonth() + 1).padStart(2, "0")}`,
        label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(moisDebut),
        ventesCdf: somme("ENTREE", "CDF"),
        ventesUsd: somme("ENTREE", "USD"),
        depensesCdf: somme("SORTIE", "CDF"),
        depensesUsd: somme("SORTIE", "USD"),
      });
    }

    const [dettes, creances] = await Promise.all([
      this.prisma.comptableDebt.findMany({
        where: { activityId: { in: activityIds }, settled: false, type: { in: ["DETTE", "EMPRUNT"] } },
        include: { payments: true },
      }),
      this.prisma.comptableDebt.findMany({
        where: { activityId: { in: activityIds }, settled: false, type: "CREANCE" },
        include: { payments: true },
      }),
    ]);

    const soldeRestant = (d: (typeof dettes)[number]) => {
      const paye = d.payments.reduce((s, p) => s + Number(p.amount), 0);
      return Math.max(Number(d.amount) - paye, 0);
    };

    const genereLe = new Date().toISOString();
    const codeVerification = this.coderVerification([
      userId,
      genereLe.slice(0, 10),
      historiqueMensuel.map((m) => `${m.ventesCdf}:${m.ventesUsd}:${m.depensesCdf}:${m.depensesUsd}`).join(","),
      dettes.length,
      creances.length,
    ]);

    return {
      userId,
      nomUtilisateur,
      activites: activites.map((a) => ({ id: a.id, name: a.name, category: a.category, creeeLe: a.createdAt.toISOString() })),
      historiqueMensuel,
      dettesOuvertes: dettes.map((d) => ({
        type: d.type,
        counterpartyName: d.counterpartyName,
        amount: Number(d.amount),
        currency: d.currency,
        solde: soldeRestant(d),
      })),
      creancesOuvertes: creances.map((d) => ({
        counterpartyName: d.counterpartyName,
        amount: Number(d.amount),
        currency: d.currency,
        solde: soldeRestant(d),
      })),
      genereLe,
      codeVerification,
    };
  }
}
