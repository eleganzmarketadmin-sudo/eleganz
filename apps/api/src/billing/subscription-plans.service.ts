import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSubscriptionPlanDto, UpdateSubscriptionPlanDto } from "./dto/subscription-plan.dto";
import { PlanCategory, Prisma } from "@eleganz/database";

@Injectable()
export class SubscriptionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        category: dto.category,
        name: dto.name,
        monthlyPrice: dto.monthlyPrice,
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
        maxActiveProducts: dto.maxActiveProducts,
        active: dto.active,
        featuresJson: dto.features as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
