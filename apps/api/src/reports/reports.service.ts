import { BadRequestException, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { construireClasseurExcel } from "../common/xlsx.util";

const LABELS_REGROUPEMENT: Record<string, string> = {
  PRODUIT: "Produit",
  CATEGORIE: "Catégorie",
  MOYEN_PAIEMENT: "Moyen de paiement",
  BOUTIQUE: "Boutique",
};

export type Granularite = "JOUR" | "SEMAINE" | "MOIS" | "ANNEE";
export type Regroupement = "PRODUIT" | "CATEGORIE" | "MOYEN_PAIEMENT" | "BOUTIQUE";

export interface ParametresReleve {
  /** Absent = relevé plateforme entière (toutes boutiques) — réservé à l'admin. */
  shopId?: string;
  from: Date;
  to: Date;
  granularite: Granularite;
  regroupement?: Regroupement;
}

interface Cellule {
  montantUSD: number;
  montantCDF: number;
  quantite: number;
  ventes: Set<string>;
}

export interface ReleveActivite {
  shopId: string | null;
  shopName: string | null;
  from: string;
  to: string;
  granularite: Granularite;
  regroupement: Regroupement | null;
  periodes: { cle: string; label: string }[];
  groupes: string[];
  // cellules[groupe][periodeCle] = { montantUSD, montantCDF, quantite, ventesCount }
  cellules: Record<string, Record<string, { montantUSD: number; montantCDF: number; quantite: number; ventesCount: number }>>;
  totauxParPeriode: Record<string, { montantUSD: number; montantCDF: number; quantite: number }>;
  totauxParGroupe: Record<string, { montantUSD: number; montantCDF: number; quantite: number }>;
  totalGeneral: { montantUSD: number; montantCDF: number; quantite: number; ventesCount: number };
  genereLe: string;
  codeCertification: string;
}

const LABELS_PAIEMENT: Record<string, string> = {
  CASH: "Espèces",
  MOBILE_MONEY: "Mobile money",
  CARD: "Carte",
  BANK_TRANSFER: "Virement",
  STORE_CREDIT: "Crédit client",
  CASH_ON_DELIVERY: "Paiement à la livraison",
};

const LABEL_PAIEMENT_LIVRAISON_MARKETPLACE = "Paiement à la livraison (Marketplace)";

const GRANULARITES: Granularite[] = ["JOUR", "SEMAINE", "MOIS", "ANNEE"];
const REGROUPEMENTS: Regroupement[] = ["PRODUIT", "CATEGORIE", "MOYEN_PAIEMENT", "BOUTIQUE"];

/**
 * Relevés d'activité périodiques "certifiés" par la plateforme (demande du
 * 12 oct. 2026) — c'est ELEGANZ, et non le vendeur lui-même, qui calcule et
 * authentifie ces chiffres à partir des ventes réellement enregistrées
 * (caisse + Marketplace). "Certifié" ici signifie : généré côté serveur à
 * partir des données de vente, horodaté, et accompagné d'un code de
 * vérification (empreinte des totaux) — ce n'est pas une certification
 * comptable/fiscale au sens légal, qui n'existe pas encore pour ELEGANZ.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async genererReleve(params: ParametresReleve): Promise<ReleveActivite> {
    this.validerParametres(params);

    const whereShop = params.shopId ? { shopId: params.shopId } : {};

    const [ventesCaisse, commandesMarketplace, shop] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { ...whereShop, createdAt: { gte: params.from, lt: params.to }, status: { not: "CANCELLED" } },
        include: {
          shop: { select: { name: true } },
          lines: { include: { variant: { include: { product: true } } } },
          payments: true,
        },
      }),
      this.prisma.shopOrder.findMany({
        where: { ...whereShop, createdAt: { gte: params.from, lt: params.to }, status: { not: "CANCELLED" } },
        include: {
          shop: { select: { name: true } },
          lines: { include: { variant: { include: { product: true } } } },
          order: { select: { currency: true } },
        },
      }),
      params.shopId
        ? this.prisma.shop.findUnique({ where: { id: params.shopId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    const cellules = new Map<string, Map<string, Cellule>>();
    const periodesLabel = new Map<string, string>();
    const groupes = new Set<string>();

    const ajouter = (groupe: string, date: Date, montant: number, devise: string, quantite: number, venteId: string) => {
      const { cle, label } = this.cleBucket(date, params.granularite);
      periodesLabel.set(cle, label);
      groupes.add(groupe);
      if (!cellules.has(groupe)) cellules.set(groupe, new Map());
      const parGroupe = cellules.get(groupe)!;
      if (!parGroupe.has(cle)) {
        parGroupe.set(cle, { montantUSD: 0, montantCDF: 0, quantite: 0, ventes: new Set() });
      }
      const cellule = parGroupe.get(cle)!;
      if (devise === "CDF") cellule.montantCDF += montant;
      else cellule.montantUSD += montant;
      cellule.quantite += quantite;
      cellule.ventes.add(venteId);
    };

    if (params.regroupement === "MOYEN_PAIEMENT") {
      for (const vente of ventesCaisse) {
        for (const paiement of vente.payments) {
          ajouter(
            LABELS_PAIEMENT[paiement.method] ?? paiement.method,
            vente.createdAt,
            Number(paiement.amount),
            vente.currency,
            0,
            vente.id,
          );
        }
      }
      for (const commande of commandesMarketplace) {
        ajouter(
          LABEL_PAIEMENT_LIVRAISON_MARKETPLACE,
          commande.createdAt,
          Number(commande.subtotal),
          commande.order.currency,
          0,
          commande.id,
        );
      }
    } else {
      const determinerGroupe = (ctx: { shopName: string; produitNom: string; categorie: string }) => {
        switch (params.regroupement) {
          case "PRODUIT":
            return ctx.produitNom;
          case "CATEGORIE":
            return ctx.categorie;
          case "BOUTIQUE":
            return ctx.shopName;
          default:
            return "Total";
        }
      };

      for (const vente of ventesCaisse) {
        for (const ligne of vente.lines) {
          const groupe = determinerGroupe({
            shopName: vente.shop.name,
            produitNom: ligne.variant?.product?.name ?? ligne.label,
            categorie: ligne.variant?.product?.category ?? "Sans catégorie",
          });
          ajouter(groupe, vente.createdAt, ligne.quantity * Number(ligne.unitPrice), vente.currency, ligne.quantity, vente.id);
        }
      }
      for (const commande of commandesMarketplace) {
        for (const ligne of commande.lines) {
          const groupe = determinerGroupe({
            shopName: commande.shop.name,
            produitNom: ligne.variant.product.name,
            categorie: ligne.variant.product.category ?? "Sans catégorie",
          });
          ajouter(
            groupe,
            commande.createdAt,
            ligne.quantity * Number(ligne.unitPrice),
            commande.order.currency,
            ligne.quantity,
            commande.id,
          );
        }
      }
    }

    const periodes = [...periodesLabel.keys()].sort().map((cle) => ({ cle, label: periodesLabel.get(cle)! }));
    const groupesTries = [...groupes.values()].sort((a, b) => a.localeCompare(b, "fr"));

    const cellulesSortie: ReleveActivite["cellules"] = {};
    const totauxParPeriode: ReleveActivite["totauxParPeriode"] = {};
    const totauxParGroupe: ReleveActivite["totauxParGroupe"] = {};
    const totalGeneral = { montantUSD: 0, montantCDF: 0, quantite: 0 };
    const ventesDistinctes = new Set<string>();

    for (const periode of periodes) {
      totauxParPeriode[periode.cle] = { montantUSD: 0, montantCDF: 0, quantite: 0 };
    }

    for (const groupe of groupesTries) {
      cellulesSortie[groupe] = {};
      totauxParGroupe[groupe] = { montantUSD: 0, montantCDF: 0, quantite: 0 };
      const parGroupe = cellules.get(groupe)!;
      for (const periode of periodes) {
        const cellule = parGroupe.get(periode.cle);
        const valeurs = cellule
          ? {
              montantUSD: cellule.montantUSD,
              montantCDF: cellule.montantCDF,
              quantite: cellule.quantite,
              ventesCount: cellule.ventes.size,
            }
          : { montantUSD: 0, montantCDF: 0, quantite: 0, ventesCount: 0 };
        cellulesSortie[groupe][periode.cle] = valeurs;

        totauxParPeriode[periode.cle].montantUSD += valeurs.montantUSD;
        totauxParPeriode[periode.cle].montantCDF += valeurs.montantCDF;
        totauxParPeriode[periode.cle].quantite += valeurs.quantite;

        totauxParGroupe[groupe].montantUSD += valeurs.montantUSD;
        totauxParGroupe[groupe].montantCDF += valeurs.montantCDF;
        totauxParGroupe[groupe].quantite += valeurs.quantite;

        totalGeneral.montantUSD += valeurs.montantUSD;
        totalGeneral.montantCDF += valeurs.montantCDF;
        totalGeneral.quantite += valeurs.quantite;
        if (cellule) for (const v of cellule.ventes) ventesDistinctes.add(v);
      }
    }

    const genereLe = new Date();
    const releve: ReleveActivite = {
      shopId: params.shopId ?? null,
      shopName: shop?.name ?? null,
      from: params.from.toISOString(),
      to: params.to.toISOString(),
      granularite: params.granularite,
      regroupement: params.regroupement ?? null,
      periodes,
      groupes: groupesTries,
      cellules: cellulesSortie,
      totauxParPeriode,
      totauxParGroupe,
      totalGeneral: { ...totalGeneral, ventesCount: ventesDistinctes.size },
      genereLe: genereLe.toISOString(),
      codeCertification: "",
    };
    releve.codeCertification = this.calculerCodeCertification(releve);
    return releve;
  }

  /**
   * Export Excel "croisé" (demande du 12 oct. 2026) : une ligne par valeur
   * du regroupement, une colonne par période, plus une ligne/colonne total —
   * exploitable tel quel ou re-pivotable par le vendeur dans Excel.
   */
  exporterExcel(releve: ReleveActivite): Promise<Buffer> {
    const formaterCellule = (montantUSD: number, montantCDF: number, quantite: number) => {
      const parts: string[] = [];
      if (montantUSD) parts.push(`$${montantUSD.toFixed(2)}`);
      if (montantCDF) parts.push(`${Math.round(montantCDF).toLocaleString("fr-FR")} FC`);
      const montant = parts.length ? parts.join(" + ") : "0";
      return quantite ? `${montant} (qté ${quantite})` : montant;
    };

    const libelleRegroupement = releve.regroupement ? LABELS_REGROUPEMENT[releve.regroupement] : "Total";
    const entetes = [libelleRegroupement, ...releve.periodes.map((p) => p.label), "Total"];

    const lignes = releve.groupes.map((groupe) => {
      const cellulesLigne = releve.periodes.map((p) => {
        const c = releve.cellules[groupe][p.cle];
        return formaterCellule(c.montantUSD, c.montantCDF, c.quantite);
      });
      const totalGroupe = releve.totauxParGroupe[groupe];
      return [groupe, ...cellulesLigne, formaterCellule(totalGroupe.montantUSD, totalGroupe.montantCDF, totalGroupe.quantite)];
    });

    const totalParPeriode = releve.periodes.map((p) => {
      const t = releve.totauxParPeriode[p.cle];
      return formaterCellule(t.montantUSD, t.montantCDF, t.quantite);
    });
    lignes.push([
      "TOTAL GÉNÉRAL",
      ...totalParPeriode,
      formaterCellule(releve.totalGeneral.montantUSD, releve.totalGeneral.montantCDF, releve.totalGeneral.quantite),
    ]);
    lignes.push([]);
    lignes.push([
      `Relevé certifié par la plateforme ELEGANZ — généré le ${new Date(releve.genereLe).toLocaleString("fr-FR")}. Code de vérification : ${releve.codeCertification}.`,
    ]);

    return construireClasseurExcel("Relevé d'activité", entetes, lignes);
  }

  /**
   * Empreinte des totaux + des bornes du relevé (SHA-256 tronquée) —
   * permet de vérifier après coup qu'un relevé exporté n'a pas été modifié
   * manuellement avant d'être transmis à un tiers. Ne remplace pas une
   * signature électronique légale, qui n'existe pas encore pour ELEGANZ.
   */
  private calculerCodeCertification(releve: Omit<ReleveActivite, "codeCertification">): string {
    const empreinte = JSON.stringify({
      shopId: releve.shopId,
      from: releve.from,
      to: releve.to,
      granularite: releve.granularite,
      regroupement: releve.regroupement,
      totalGeneral: releve.totalGeneral,
      genereLe: releve.genereLe,
    });
    return createHash("sha256").update(empreinte).digest("hex").slice(0, 16).toUpperCase();
  }

  private validerParametres(params: ParametresReleve) {
    if (!(params.from instanceof Date) || Number.isNaN(params.from.getTime())) {
      throw new BadRequestException("Date de début invalide.");
    }
    if (!(params.to instanceof Date) || Number.isNaN(params.to.getTime())) {
      throw new BadRequestException("Date de fin invalide.");
    }
    if (params.from >= params.to) {
      throw new BadRequestException("La date de début doit précéder la date de fin.");
    }
    if (!GRANULARITES.includes(params.granularite)) {
      throw new BadRequestException(`Granularité invalide — valeurs possibles : ${GRANULARITES.join(", ")}.`);
    }
    if (params.regroupement && !REGROUPEMENTS.includes(params.regroupement)) {
      throw new BadRequestException(`Regroupement invalide — valeurs possibles : ${REGROUPEMENTS.join(", ")}.`);
    }
    if (params.regroupement === "BOUTIQUE" && params.shopId) {
      throw new BadRequestException("Le regroupement par boutique n'a de sens que pour un relevé plateforme entière.");
    }
    const ecartJours = (params.to.getTime() - params.from.getTime()) / 86_400_000;
    if (ecartJours > 20 * 365) {
      throw new BadRequestException("Période trop large (20 ans maximum).");
    }
  }

  private cleBucket(date: Date, granularite: Granularite): { cle: string; label: string } {
    const d = new Date(date);
    if (granularite === "JOUR") {
      const cle = d.toISOString().slice(0, 10);
      return { cle, label: new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(d) };
    }
    if (granularite === "SEMAINE") {
      const lundi = new Date(d);
      const jourSemaine = (lundi.getUTCDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
      lundi.setUTCDate(lundi.getUTCDate() - jourSemaine);
      lundi.setUTCHours(0, 0, 0, 0);
      const cle = lundi.toISOString().slice(0, 10);
      return { cle, label: `Semaine du ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(lundi)}` };
    }
    if (granularite === "MOIS") {
      const cle = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const libelle = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
      return { cle, label: libelle.charAt(0).toUpperCase() + libelle.slice(1) };
    }
    // ANNEE
    const cle = String(d.getUTCFullYear());
    return { cle, label: cle };
  }
}
