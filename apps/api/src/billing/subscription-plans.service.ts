import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { PlanCategory, Prisma } from "@eleganz/database";

/**
 * Bouquets ELEGANZ Gestion de départ (14 oct. 2026, plan commercial soumis
 * au propriétaire puis validé) — trois paliers alignés sur ce que le moteur
 * comptable sait déjà faire (voir docs/ARCHITECTURE_FINANCE.md et
 * docs/PLAN_COMMERCIAL.md). Les clés de `featuresJson` sont celles lues par
 * `ShopMembershipGuard`/`RequiresGestionFeature` pour restreindre l'accès
 * aux écrans Finance avancée — jamais une liste décorative.
 *
 * Ce ne sont que des VALEURS DE DÉPART : entièrement modifiables ensuite
 * depuis /admin/tarifs (prix, limites, fonctionnalités) sans redéploiement.
 * Ce seed ne s'exécute qu'une fois (vérifie qu'aucun bouquet Gestion
 * n'existe déjà) — il ne réinitialise jamais un bouquet déjà modifié par
 * l'administrateur.
 */
const BOUQUETS_GESTION_DE_DEPART: Array<{
  name: string;
  openingFee: number;
  monthlyPrice: number;
  maxActiveProducts: number | null;
  // Bouquet désactivé à la création (visible seulement en admin via
  // `listAll()`, jamais dans `list()` côté public) — utilisé pour "Ultime"
  // le 14 oct. 2026 : créé déjà, mais son prix réel reste à fixer depuis
  // /admin/tarifs avant toute activation (voir Doc SYSCOHADA, tab E).
  // Omis (donc `true`) pour les bouquets déjà vendus.
  active?: boolean;
  // `maxEquipe` est numérique (ou `null` = illimité) ; toutes les autres clés
  // sont des booléens — voir ShopsService.inviteStaff/ShopMembershipGuard,
  // qui lisent ce même featuresJson. Un index signature séparé (plutôt que
  // Record<string, boolean>) est nécessaire car il ne peut pas y avoir deux
  // types différents pour des clés d'un même objet avec Record<string, X>.
  featuresJson: {
    financeAvancee: boolean;
    immobilisations: boolean;
    cloture: boolean;
    tresorerie: boolean;
    comptableExterne: boolean;
    variantesProduits: boolean;
    exportExcelPdf: boolean;
    // Ajouté le 14 oct. 2026 — module additionnel "Comptabilité SYSCOHADA"
    // (plan comptable complet, états normalisés). Voir Doc "Finance &
    // Comptabilité SYSCOHADA — Audit & plan d'intégration", tab E.
    comptabiliteSyscohada: boolean;
    // Ajoutées le 20 oct. 2026 (audit de lancement, demande : "la liste des
    // fonctionnalités n'est pas exhaustive, exemple dossier crédit") — ces
    // 4 écrans partageaient tous la clé générique `financeAvancee`, ce qui
    // empêchait de les répartir sur des bouquets différents depuis le
    // Centre de pilotage. Valeurs de départ alignées sur `financeAvancee`
    // (même périmètre qu'avant la séparation) ; voir
    // ensureFonctionnalitesFinanceDetailleesSurBouquetsExistants()
    // ci-dessous pour les bouquets déjà créés en production.
    dossierCredit: boolean;
    businessPlan: boolean;
    prets: boolean;
    rapportAnnuel: boolean;
    maxEquipe: number | null;
  };
}> = [
  {
    name: "Starter",
    openingFee: 20,
    monthlyPrice: 5,
    maxActiveProducts: 50,
    featuresJson: {
      financeAvancee: false,
      immobilisations: false,
      cloture: false,
      tresorerie: false,
      comptableExterne: false,
      variantesProduits: false,
      exportExcelPdf: false,
      comptabiliteSyscohada: false,
      dossierCredit: false,
      businessPlan: false,
      prets: false,
      rapportAnnuel: false,
      maxEquipe: 2,
    },
  },
  {
    name: "Pro",
    openingFee: 50,
    monthlyPrice: 20,
    maxActiveProducts: 500,
    featuresJson: {
      financeAvancee: true,
      immobilisations: false,
      cloture: false,
      tresorerie: false,
      comptableExterne: false,
      variantesProduits: true,
      exportExcelPdf: true,
      comptabiliteSyscohada: false,
      dossierCredit: true,
      businessPlan: true,
      prets: true,
      rapportAnnuel: true,
      maxEquipe: 10,
    },
  },
  {
    name: "Premium",
    openingFee: 100,
    monthlyPrice: 45,
    maxActiveProducts: null,
    featuresJson: {
      financeAvancee: true,
      immobilisations: true,
      cloture: true,
      tresorerie: true,
      comptableExterne: true,
      variantesProduits: true,
      exportExcelPdf: true,
      // Gagne le module SYSCOHADA (décision du 14 oct. 2026) — voir aussi
      // ensureComptabiliteSyscohadaSurPremiumExistant() ci-dessous pour le
      // bouquet Premium déjà créé en production avant ce chantier.
      comptabiliteSyscohada: true,
      dossierCredit: true,
      businessPlan: true,
      prets: true,
      rapportAnnuel: true,
      maxEquipe: null,
    },
  },
  {
    name: "Ultime",
    // Valeur de départ neutre = même prix que Premium, volontairement non
    // ajustée par moi (décision du 14 oct. 2026 : le prix se fixe depuis le
    // centre de pilotage, jamais codé en dur par ce chantier). Le bouquet
    // est créé INACTIF : invisible côté public tant que l'administrateur ne
    // l'a pas révisé et activé depuis /admin/tarifs.
    openingFee: 100,
    monthlyPrice: 45,
    maxActiveProducts: null,
    active: false,
    featuresJson: {
      financeAvancee: true,
      immobilisations: true,
      cloture: true,
      tresorerie: true,
      comptableExterne: true,
      variantesProduits: true,
      exportExcelPdf: true,
      comptabiliteSyscohada: true,
      dossierCredit: true,
      businessPlan: true,
      prets: true,
      rapportAnnuel: true,
      maxEquipe: null,
    },
  },
];

// Clés détaillées introduites le 20 oct. 2026, séparées de `financeAvancee`
// (voir commentaire sur `featuresJson` ci-dessus) — utilisées par la
// migration de démarrage ci-dessous pour ne backfiller que celles-ci,
// jamais une autre clé.
const CLES_FINANCE_DETAILLEES = ["dossierCredit", "businessPlan", "prets", "rapportAnnuel"] as const;

@Injectable()
export class SubscriptionPlansService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * S'exécute à chaque démarrage de l'API, mais n'a d'effet qu'une seule
   * fois par bouquet en pratique (même garde que AccountingSeedService :
   * vérifie avant de créer, jamais de doublon). Ordre : créer les bouquets
   * manquants, PUIS rattacher les boutiques sans bouquet Gestion à "Pro" par
   * défaut (décision du plan commercial : aucune boutique déjà active ne
   * perd un accès qu'elle utilisait déjà).
   */
  async onModuleInit() {
    try {
      await this.seedBouquetsGestionDeDepart();
      await this.rattacherBoutiquesSansBouquet();
      await this.ensureComptabiliteSyscohadaSurPremiumExistant();
      await this.ensureFonctionnalitesFinanceDetailleesSurBouquetsExistants();
    } catch (err) {
      this.logger.error("Échec du seed des bouquets Gestion au démarrage", err);
    }
  }

  /**
   * Incident du 14 oct. 2026 : la garde initiale testait « un bouquet
   * Gestion quelconque existe-t-il déjà ? » — un bouquet de test "Essentiel"
   * créé manuellement avant ce chantier a donc fait sauter tout le seed en
   * silence, et Starter/Pro/Premium n'ont jamais été créés en production.
   * Garde corrigée : par NOM de bouquet, un par un — un bouquet existant
   * (quel que soit son nom) n'empêche plus la création des trois bouquets
   * officiels du plan commercial, et aucun bouquet déjà modifié par
   * l'administrateur n'est jamais réécrit (vérifié avant de créer, jamais
   * de `upsert` qui écraserait un prix déjà ajusté depuis /admin/tarifs).
   */
  private async seedBouquetsGestionDeDepart() {
    let nombreCrees = 0;
    for (const bouquet of BOUQUETS_GESTION_DE_DEPART) {
      const dejaPresent = await this.prisma.subscriptionPlan.findFirst({
        where: { category: PlanCategory.GESTION, name: bouquet.name },
        select: { id: true },
      });
      if (dejaPresent) continue;

      await this.prisma.subscriptionPlan.create({
        data: {
          category: PlanCategory.GESTION,
          name: bouquet.name,
          openingFee: bouquet.openingFee,
          monthlyPrice: bouquet.monthlyPrice,
          maxActiveProducts: bouquet.maxActiveProducts,
          active: bouquet.active ?? true,
          featuresJson: bouquet.featuresJson as Prisma.InputJsonValue,
        },
      });
      nombreCrees++;
    }
    if (nombreCrees > 0) {
      this.logger.log(`${nombreCrees} bouquet(s) Gestion de départ créé(s).`);
    }
  }

  /**
   * Le bouquet "Premium" existe déjà en production depuis avant ce
   * chantier (14 oct. 2026) : le seed ci-dessus ne le recréera jamais et ne
   * touchera donc pas son `featuresJson`. Cette fusion CIBLÉE n'ajoute que
   * la clé `comptabiliteSyscohada` si elle est absente — jamais un
   * remplacement du featuresJson entier, pour ne pas écraser un prix ou une
   * fonctionnalité déjà ajustée par l'administrateur depuis /admin/tarifs.
   * Ne touche aucun autre bouquet : Starter/Pro n'ont jamais eu cette
   * fonctionnalité et "Ultime" naît déjà avec elle.
   */
  private async ensureComptabiliteSyscohadaSurPremiumExistant() {
    const premium = await this.prisma.subscriptionPlan.findFirst({
      where: { category: PlanCategory.GESTION, name: "Premium" },
    });
    if (!premium) return;
    const features = (premium.featuresJson ?? {}) as Record<string, unknown>;
    if (features.comptabiliteSyscohada === true) return;

    await this.prisma.subscriptionPlan.update({
      where: { id: premium.id },
      data: {
        featuresJson: { ...features, comptabiliteSyscohada: true } as Prisma.InputJsonValue,
      },
    });
    this.logger.log("Fonctionnalité comptabiliteSyscohada ajoutée au bouquet Premium existant.");
  }

  /**
   * Migration ciblée du 20 oct. 2026 (audit de lancement, séparation de
   * `financeAvancee` en 4 clés détaillées — voir le commentaire sur
   * `featuresJson` plus haut) : pour TOUT bouquet Gestion déjà en
   * production (même modifié depuis /admin/tarifs, même créé avant ce
   * chantier), si l'une des 4 nouvelles clés est ABSENTE de son
   * `featuresJson`, on l'ajoute avec la valeur actuelle de
   * `financeAvancee` — jamais autre chose — pour qu'aucune boutique déjà
   * abonnée ne perde un accès qu'elle utilisait déjà la veille de ce
   * déploiement. Une clé déjà présente (donc déjà choisie explicitement
   * par l'administrateur depuis /admin/tarifs, même avant la séparation si
   * ce code a déjà tourné une fois) n'est jamais réécrite — même principe
   * de fusion ciblée que ensureComptabiliteSyscohadaSurPremiumExistant.
   */
  private async ensureFonctionnalitesFinanceDetailleesSurBouquetsExistants() {
    const bouquets = await this.prisma.subscriptionPlan.findMany({
      where: { category: PlanCategory.GESTION },
    });
    let nombreMisAJour = 0;
    for (const bouquet of bouquets) {
      const features = (bouquet.featuresJson ?? {}) as Record<string, unknown>;
      const valeurDeDepart = features.financeAvancee === true;
      const ajouts: Record<string, boolean> = {};
      for (const cle of CLES_FINANCE_DETAILLEES) {
        if (features[cle] === undefined) {
          ajouts[cle] = valeurDeDepart;
        }
      }
      if (Object.keys(ajouts).length === 0) continue;

      await this.prisma.subscriptionPlan.update({
        where: { id: bouquet.id },
        data: { featuresJson: { ...features, ...ajouts } as Prisma.InputJsonValue },
      });
      nombreMisAJour++;
    }
    if (nombreMisAJour > 0) {
      this.logger.log(
        `${nombreMisAJour} bouquet(s) Gestion mis à jour avec les clés détaillées dossierCredit/businessPlan/prets/rapportAnnuel.`,
      );
    }
  }

  private async rattacherBoutiquesSansBouquet() {
    const bouquetParDefaut = await this.prisma.subscriptionPlan.findFirst({
      where: { category: PlanCategory.GESTION, name: "Pro" },
      select: { id: true },
    });
    if (!bouquetParDefaut) return;

    const resultat = await this.prisma.shop.updateMany({
      where: { gestionBouquetId: null },
      data: { gestionBouquetId: bouquetParDefaut.id },
    });
    if (resultat.count > 0) {
      this.logger.log(`${resultat.count} boutique(s) existante(s) rattachée(s) au bouquet Pro par défaut.`);
    }
  }

  // Note : l'attribution du bouquet Gestion de départ à une boutique nouvellement
  // créée est faite directement dans ShopsService.create() via une requête
  // Prisma (et non ici) pour éviter une dépendance circulaire BillingModule ↔
  // ShopsModule (BillingModule importe déjà ShopsModule).

  create(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        category: dto.category,
        name: dto.name,
        monthlyPrice: dto.monthlyPrice,
        openingFee: dto.openingFee ?? 0,
        maxActiveProducts: dto.maxActiveProducts,
        commissionRate: dto.commissionRate,
        featuresJson: (dto.features ?? {}) as Prisma.InputJsonValue,
        tagline: dto.tagline,
      },
    });
  }

  list(category?: PlanCategory) {
    return this.prisma.subscriptionPlan.findMany({
      where: { active: true, ...(category ? { category } : {}) },
      orderBy: { monthlyPrice: "asc" },
    });
  }

  /**
   * Vue admin : tous les bouquets, y compris désactivés — nécessaire pour
   * pouvoir réactiver un bouquet retiré sans repasser par la base de
   * données directement.
   */
  listAll(category?: PlanCategory) {
    return this.prisma.subscriptionPlan.findMany({
      where: category ? { category } : {},
      orderBy: [{ category: "asc" }, { monthlyPrice: "asc" }],
    });
  }

  update(planId: string, dto: UpdateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.update({
      where: { id: planId },
      data: {
        monthlyPrice: dto.monthlyPrice,
        openingFee: dto.openingFee,
        maxActiveProducts: dto.maxActiveProducts,
        commissionRate: dto.commissionRate,
        active: dto.active,
        featuresJson: dto.features as Prisma.InputJsonValue | undefined,
        tagline: dto.tagline,
      },
    });
  }
}
