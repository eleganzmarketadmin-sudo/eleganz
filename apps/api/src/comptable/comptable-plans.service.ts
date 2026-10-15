import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@eleganz/database";
import { CreateComptablePlanDto, UpdateComptablePlanDto } from "./dto/comptable-plan.dto";

/**
 * Bouquets ELEGANZ Secourable (14 oct. 2026, proposition soumise au
 * propriétaire puis validée — voir docs/PLAN_COMMERCIAL.md). Trois paliers :
 * "Essentiel" reprend EXACTEMENT l'offre actuelle (1 $/mois, 10 $/an,
 * 1 activité) pour ne rien changer aux abonnés déjà sur cette offre — voir
 * rattacherAbonnesSansBouquet ci-dessous, qui les rattache au bouquet "Pro",
 * jamais "Essentiel", pour ne perdre aucun accès déjà utilisé si un abonné
 * suit déjà plusieurs activités.
 *
 * Ce ne sont que des VALEURS DE DÉPART : entièrement modifiables ensuite
 * depuis /admin/tarifs (prix, limites, fonctionnalités) sans redéploiement.
 */
const BOUQUETS_COMPTABLE_DE_DEPART: Array<{
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxActivities: number | null;
  featuresJson: {
    historiqueIllimite: boolean;
    comparaisonPeriodes: boolean;
    rappelsAgenda: boolean;
    exportDossierFinancement: boolean;
  };
}> = [
  {
    name: "Essentiel",
    monthlyPrice: 1,
    yearlyPrice: 10,
    maxActivities: 1,
    featuresJson: {
      historiqueIllimite: false,
      comparaisonPeriodes: false,
      rappelsAgenda: false,
      exportDossierFinancement: false,
    },
  },
  {
    name: "Pro",
    monthlyPrice: 3,
    yearlyPrice: 30,
    maxActivities: 5,
    featuresJson: {
      historiqueIllimite: true,
      comparaisonPeriodes: true,
      rappelsAgenda: true,
      exportDossierFinancement: false,
    },
  },
  {
    name: "Premium",
    monthlyPrice: 7,
    yearlyPrice: 70,
    maxActivities: null,
    featuresJson: {
      historiqueIllimite: true,
      comparaisonPeriodes: true,
      rappelsAgenda: true,
      exportDossierFinancement: true,
    },
  },
];

@Injectable()
export class ComptablePlansService implements OnModuleInit {
  private readonly logger = new Logger(ComptablePlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.seedBouquetsDeDepart();
      await this.rattacherAbonnesSansBouquet();
    } catch (err) {
      this.logger.error("Échec du seed des bouquets Secourable au démarrage", err);
    }
  }

  // Garde par NOM, pas "un bouquet existe-t-il déjà" — même correction que
  // pour ELEGANZ Gestion (incident du 14 oct. 2026, voir
  // SubscriptionPlansService et docs/PLAN_COMMERCIAL.md) : un bouquet déjà
  // modifié par l'admin n'est jamais écrasé ni dupliqué.
  private async seedBouquetsDeDepart() {
    let nombreCrees = 0;
    for (const bouquet of BOUQUETS_COMPTABLE_DE_DEPART) {
      const dejaPresent = await this.prisma.comptablePlan.findFirst({
        where: { name: bouquet.name },
        select: { id: true },
      });
      if (dejaPresent) continue;

      await this.prisma.comptablePlan.create({
        data: {
          name: bouquet.name,
          monthlyPrice: bouquet.monthlyPrice,
          yearlyPrice: bouquet.yearlyPrice,
          maxActivities: bouquet.maxActivities,
          featuresJson: bouquet.featuresJson as Prisma.InputJsonValue,
        },
      });
      nombreCrees++;
    }
    if (nombreCrees > 0) {
      this.logger.log(`${nombreCrees} bouquet(s) Secourable de départ créé(s).`);
    }
  }

  private async rattacherAbonnesSansBouquet() {
    const bouquetParDefaut = await this.prisma.comptablePlan.findFirst({
      where: { name: "Pro" },
      select: { id: true },
    });
    if (!bouquetParDefaut) return;

    const resultat = await this.prisma.comptableSubscription.updateMany({
      where: { bouquetId: null },
      data: { bouquetId: bouquetParDefaut.id },
    });
    if (resultat.count > 0) {
      this.logger.log(`${resultat.count} abonnement(s) Secourable existant(s) rattaché(s) au bouquet Pro par défaut.`);
    }
  }

  list() {
    return this.prisma.comptablePlan.findMany({
      where: { active: true },
      orderBy: { monthlyPrice: "asc" },
    });
  }

  listAll() {
    return this.prisma.comptablePlan.findMany({ orderBy: { monthlyPrice: "asc" } });
  }

  create(dto: CreateComptablePlanDto) {
    return this.prisma.comptablePlan.create({
      data: {
        name: dto.name,
        monthlyPrice: dto.monthlyPrice,
        yearlyPrice: dto.yearlyPrice,
        maxActivities: dto.maxActivities,
        featuresJson: (dto.features ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  update(id: string, dto: UpdateComptablePlanDto) {
    return this.prisma.comptablePlan.update({
      where: { id },
      data: {
        name: dto.name,
        monthlyPrice: dto.monthlyPrice,
        yearlyPrice: dto.yearlyPrice,
        maxActivities: dto.maxActivities,
        active: dto.active,
        featuresJson: dto.features as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
