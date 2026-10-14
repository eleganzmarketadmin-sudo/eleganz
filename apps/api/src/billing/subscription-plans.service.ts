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
      maxEquipe: null,
    },
  },
];

@Injectable()
export class SubscriptionPlansService implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionPlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * S'exécute à chaque démarrage de l'API, mais n'a d'effet qu'une seule
   * fois en pratique (même garde que AccountingSeedService : vérifie avant
   * de créer, jamais de doublon). Ordre : créer les bouquets manquants,
   * PUIS rattacher les boutiques sans bouquet Gestion à "Pro" par défaut
   * (décision du plan commercial : aucune boutique déjà active ne perd un
   * accès qu'elle utilisait déjà).
   */
  async onModuleInit() {
    try {
      await this.seedBouquetsGestionDeDepart();
      await this.rattacherBoutiquesSansBouquet();
    } catch (err) {
      this.logger.error("Échec du seed des bouquets Gestion au démarrage", err);
    }
  }

  private async seedBouquetsGestionDeDepart() {
    const dejaPresent = await this.prisma.subscriptionPlan.findFirst({
      where: { category: PlanCategory.GESTION },
      select: { id: true },
    });
    if (dejaPresent) return;

    for (const bouquet of BOUQUETS_GESTION_DE_DEPART) {
      await this.prisma.subscriptionPlan.create({
        data: {
          category: PlanCategory.GESTION,
          name: bouquet.name,
          openingFee: bouquet.openingFee,
          monthlyPrice: bouquet.monthlyPrice,
          maxActiveProducts: bouquet.maxActiveProducts,
          featuresJson: bouquet.featuresJson as Prisma.InputJsonValue,
        },
      });
    }
    this.logger.log(`${BOUQUETS_GESTION_DE_DEPART.length} bouquets Gestion de départ créés.`);
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
        featuresJson: (dto.features ?? {}) as Prisma.InputJsonValue,
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
        active: dto.active,
        featuresJson: dto.features as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
