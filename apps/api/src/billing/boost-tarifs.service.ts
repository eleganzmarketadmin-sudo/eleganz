import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBoostTarifDto, UpdateBoostTarifDto } from "./dto/boost-tarif.dto";
import { BoostCible, Prisma } from "@eleganz/database";

// Paliers de départ (27 nov. 2026, refonte ELEGANZ BOOST) — repris de la
// proposition de tarification fournie par le propriétaire, adaptés en
// nombre de paliers (4-5 par famille plutôt que 6-7) pour rester
// maintenables depuis l'écran admin ; VALEURS DE DÉPART uniquement,
// entièrement modifiables ensuite depuis le Centre de pilotage "Boost"
// (prix, durée, matrice de fonctionnalités) sans redéploiement — jamais
// recréées si un tarif existe déjà pour ce (cible, nom), même principe que
// BOUQUETS_GESTION_DE_DEPART dans subscription-plans.service.ts.
//
// `featuresJson` pour SOCIAL_360 porte à la fois la matrice comparative
// (rechercheSponsorisee, statistiquesDetaillees...) ET les clés canal —
// FACEBOOK/INSTAGRAM/TIKTOK/GOOGLE/X (valeurs BoostCanal) — qui délimitent
// quels canaux une boutique peut choisir à l'achat (voir BoostService.acheter
// et CreateBoostDto.canaux). Aucun de ces canaux n'est réellement "connecté"
// à ce stade (voir BoostCanalConfig) : des champs structurés prêts à l'être,
// pas un appel réel vers une régie publicitaire (réponse Q1 du cadrage).
const BOOST_TARIFS_DE_DEPART: Array<{
  cible: BoostCible;
  nom: string;
  ordre: number;
  dureeJours: number;
  prixUSD: number;
  prixCDF?: number;
  maxProduits?: number;
  featuresJson: Record<string, boolean | number>;
}> = [
  // --- Boost Produit : un seul article mis en avant ---
  { cible: BoostCible.PRODUIT, nom: "Flash", ordre: 1, dureeJours: 3, prixUSD: 2, featuresJson: { rechercheSponsorisee: true } },
  { cible: BoostCible.PRODUIT, nom: "Starter", ordre: 2, dureeJours: 7, prixUSD: 5, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true } },
  { cible: BoostCible.PRODUIT, nom: "Plus", ordre: 3, dureeJours: 15, prixUSD: 9, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true, recommandations: true } },
  { cible: BoostCible.PRODUIT, nom: "Gold", ordre: 4, dureeJours: 30, prixUSD: 15, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true, recommandations: true, statistiquesDetaillees: true } },
  { cible: BoostCible.PRODUIT, nom: "Platinum", ordre: 5, dureeJours: 30, prixUSD: 20, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true, recommandations: true, statistiquesDetaillees: true, emplacementsPremium: true } },

  // --- Boost Collection : plusieurs articles sous une même campagne ---
  { cible: BoostCible.COLLECTION, nom: "Mini", ordre: 1, dureeJours: 10, prixUSD: 5, maxProduits: 5, featuresJson: { rechercheSponsorisee: true } },
  { cible: BoostCible.COLLECTION, nom: "Starter", ordre: 2, dureeJours: 15, prixUSD: 15, maxProduits: 10, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true } },
  { cible: BoostCible.COLLECTION, nom: "Plus", ordre: 3, dureeJours: 30, prixUSD: 40, maxProduits: 20, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true, recommandations: true, statistiquesDetaillees: true } },
  { cible: BoostCible.COLLECTION, nom: "Corporate", ordre: 4, dureeJours: 30, prixUSD: 90, maxProduits: 50, featuresJson: { rechercheSponsorisee: true, mentionSponsorisee: true, recommandations: true, statistiquesDetaillees: true, emplacementsPremium: true } },

  // --- Boost Boutique : toute la boutique mise en avant ---
  { cible: BoostCible.BOUTIQUE, nom: "Starter", ordre: 1, dureeJours: 15, prixUSD: 10, maxProduits: 10, featuresJson: { boutiquesRecommandees: true } },
  { cible: BoostCible.BOUTIQUE, nom: "Plus", ordre: 2, dureeJours: 30, prixUSD: 25, maxProduits: 30, featuresJson: { boutiquesRecommandees: true, accueilRotation: true } },
  { cible: BoostCible.BOUTIQUE, nom: "Pro", ordre: 3, dureeJours: 30, prixUSD: 60, maxProduits: 100, featuresJson: { boutiquesRecommandees: true, accueilRotation: true, statistiquesDetaillees: true } },
  { cible: BoostCible.BOUTIQUE, nom: "Corporate", ordre: 4, dureeJours: 30, prixUSD: 120, featuresJson: { boutiquesRecommandees: true, accueilRotation: true, statistiquesDetaillees: true, banniere: true, gestionnaireCampagne: true } },

  // --- Boost 360° : campagne multicanale interne + réseaux sociaux ---
  { cible: BoostCible.SOCIAL_360, nom: "Starter", ordre: 1, dureeJours: 30, prixUSD: 30, featuresJson: { FACEBOOK: true, INSTAGRAM: true, visuelsIA: 2, statistiquesDetaillees: true } },
  { cible: BoostCible.SOCIAL_360, nom: "Pro", ordre: 2, dureeJours: 30, prixUSD: 80, featuresJson: { FACEBOOK: true, INSTAGRAM: true, TIKTOK: true, visuelsIA: 4, videosIA: 1, statistiquesDetaillees: true, gestionnaireCampagne: true } },
  { cible: BoostCible.SOCIAL_360, nom: "Gold", ordre: 3, dureeJours: 30, prixUSD: 200, featuresJson: { FACEBOOK: true, INSTAGRAM: true, TIKTOK: true, GOOGLE: true, visuelsIA: 8, videosIA: 2, statistiquesDetaillees: true, gestionnaireCampagne: true, emplacementsPremium: true } },
  { cible: BoostCible.SOCIAL_360, nom: "Corporate", ordre: 4, dureeJours: 30, prixUSD: 400, featuresJson: { FACEBOOK: true, INSTAGRAM: true, TIKTOK: true, GOOGLE: true, X: true, visuelsIA: 15, videosIA: 4, statistiquesDetaillees: true, gestionnaireCampagne: true, emplacementsPremium: true, banniere: true } },
];

/**
 * Catalogue de forfaits Boost (26 nov. 2026, demande propriétaire ; étendu
 * le 27 nov. 2026 — refonte ELEGANZ BOOST : familles PRODUIT/COLLECTION/
 * BOUTIQUE/SOCIAL_360, plusieurs paliers nommés par famille, prix USD+CDF,
 * matrice de fonctionnalités libre par palier) — même esprit que
 * SubscriptionPlansService : entièrement configurable par l'admin depuis le
 * nouveau menu Centre de pilotage "Boost", aucune valeur figée dans le code.
 */
@Injectable()
export class BoostTarifsService implements OnModuleInit {
  private readonly logger = new Logger(BoostTarifsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedBoostTarifsDeDepart();
    } catch (err) {
      this.logger.error("Échec du seed des tarifs Boost de départ", err);
    }
  }

  /**
   * N'crée que les (cible, nom) absents — un tarif déjà présent, même
   * modifié par l'administrateur, n'est jamais réécrit (même garde que
   * SubscriptionPlansService.seedBouquetsGestionDeDepart).
   */
  private async seedBoostTarifsDeDepart() {
    let nombreCrees = 0;
    for (const tarif of BOOST_TARIFS_DE_DEPART) {
      const dejaPresent = await this.prisma.boostTarif.findFirst({
        where: { cible: tarif.cible, nom: tarif.nom },
        select: { id: true },
      });
      if (dejaPresent) continue;

      await this.prisma.boostTarif.create({
        data: {
          cible: tarif.cible,
          nom: tarif.nom,
          ordre: tarif.ordre,
          dureeJours: tarif.dureeJours,
          prixUSD: tarif.prixUSD,
          prixCDF: tarif.prixCDF,
          maxProduits: tarif.maxProduits,
          featuresJson: tarif.featuresJson as Prisma.InputJsonValue,
        },
      });
      nombreCrees++;
    }
    if (nombreCrees > 0) {
      this.logger.log(`${nombreCrees} tarif(s) Boost de départ créé(s).`);
    }
  }

  // Public : une boutique doit pouvoir consulter les forfaits disponibles
  // pour démarrer un boost sans passer par l'admin.
  list(cible?: BoostCible) {
    return this.prisma.boostTarif.findMany({
      where: { actif: true, ...(cible ? { cible } : {}) },
      orderBy: [{ cible: "asc" }, { ordre: "asc" }, { dureeJours: "asc" }],
    });
  }

  /**
   * Vue admin : tous les tarifs, y compris désactivés — nécessaire pour
   * pouvoir réactiver un forfait retiré sans repasser par la base de
   * données directement (même convention que SubscriptionPlansService.listAll).
   */
  listAll(cible?: BoostCible) {
    return this.prisma.boostTarif.findMany({
      where: cible ? { cible } : {},
      orderBy: [{ cible: "asc" }, { ordre: "asc" }, { dureeJours: "asc" }],
    });
  }

  create(dto: CreateBoostTarifDto) {
    return this.prisma.boostTarif.create({
      data: {
        cible: dto.cible,
        nom: dto.nom,
        ordre: dto.ordre ?? 0,
        dureeJours: dto.dureeJours,
        prixUSD: dto.prixUSD,
        prixCDF: dto.prixCDF,
        maxProduits: dto.maxProduits,
        featuresJson: (dto.featuresJson ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  update(tarifId: string, dto: UpdateBoostTarifDto) {
    return this.prisma.boostTarif.update({
      where: { id: tarifId },
      data: {
        ...(dto.nom !== undefined ? { nom: dto.nom } : {}),
        ...(dto.ordre !== undefined ? { ordre: dto.ordre } : {}),
        ...(dto.dureeJours !== undefined ? { dureeJours: dto.dureeJours } : {}),
        ...(dto.prixUSD !== undefined ? { prixUSD: dto.prixUSD } : {}),
        ...(dto.prixCDF !== undefined ? { prixCDF: dto.prixCDF } : {}),
        ...(dto.maxProduits !== undefined ? { maxProduits: dto.maxProduits } : {}),
        ...(dto.featuresJson !== undefined ? { featuresJson: dto.featuresJson as Prisma.InputJsonValue } : {}),
        ...(dto.actif !== undefined ? { actif: dto.actif } : {}),
      },
    });
  }
}
