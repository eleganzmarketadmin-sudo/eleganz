import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FiscalRuleScope } from "@eleganz/database";
import { CreateFiscalRemittanceDto, UpdateFiscalRemittanceDto } from "./dto/fiscal-remittance.dto";

/**
 * Reversements réels (13 nov. 2026, signalement : "aucune option pour voir
 * les récap/relevés ... qu'on peut s'en servir ... pour la déclaration ou
 * contre-vérification ... et pour les reversements") — voir le modèle
 * FiscalRemittance (schema.prisma) : une ligne par paiement réellement
 * effectué à l'État ou à la CNSS, jamais une prévision (l'estimation reste
 * du côté de FiscalSimulationService, qui les combine dans releveShop/
 * relevePlatform). Même patron de séparation SHOP/PLATFORM que
 * FiscalRulesService : chaque méthode vérifie d'abord que la règle visée
 * appartient bien au scope (et, côté boutique, à la boutique) attendu avant
 * de lire ou d'écrire quoi que ce soit — jamais seulement par l'affichage.
 */
@Injectable()
export class FiscalRemittanceService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async listForShopRule(shopId: string, ruleId: string) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId } });
    return this.prisma.fiscalRemittance.findMany({ where: { ruleId }, orderBy: { paidAt: "desc" } });
  }

  async createForShopRule(shopId: string, ruleId: string, authorId: string, dto: CreateFiscalRemittanceDto) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId } });
    return this.create(ruleId, authorId, dto);
  }

  async updateForShopRule(
    shopId: string,
    ruleId: string,
    remittanceId: string,
    dto: UpdateFiscalRemittanceDto,
  ) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId } });
    return this.update(ruleId, remittanceId, dto);
  }

  async deleteForShopRule(shopId: string, ruleId: string, remittanceId: string) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId } });
    return this.delete(ruleId, remittanceId);
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  async listForPlatformRule(ruleId: string) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.PLATFORM } });
    return this.prisma.fiscalRemittance.findMany({ where: { ruleId }, orderBy: { paidAt: "desc" } });
  }

  async createForPlatformRule(ruleId: string, authorId: string, dto: CreateFiscalRemittanceDto) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.PLATFORM } });
    return this.create(ruleId, authorId, dto);
  }

  async updateForPlatformRule(ruleId: string, remittanceId: string, dto: UpdateFiscalRemittanceDto) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.PLATFORM } });
    return this.update(ruleId, remittanceId, dto);
  }

  async deleteForPlatformRule(ruleId: string, remittanceId: string) {
    await this.prisma.fiscalRule.findFirstOrThrow({ where: { id: ruleId, scope: FiscalRuleScope.PLATFORM } });
    return this.delete(ruleId, remittanceId);
  }

  // --- Partagé -------------------------------------------------------------

  private create(ruleId: string, authorId: string, dto: CreateFiscalRemittanceDto) {
    return this.prisma.fiscalRemittance.create({
      data: {
        ruleId,
        periodLabel: dto.periodLabel,
        periodFrom: new Date(dto.periodFrom),
        periodTo: new Date(dto.periodTo),
        declaredAmount: dto.declaredAmount ?? undefined,
        paidAmount: dto.paidAmount,
        devise: dto.devise || "USD",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        reference: dto.reference,
        note: dto.note,
        authorId,
      },
    });
  }

  private async update(ruleId: string, remittanceId: string, dto: UpdateFiscalRemittanceDto) {
    await this.prisma.fiscalRemittance.findFirstOrThrow({ where: { id: remittanceId, ruleId } });
    return this.prisma.fiscalRemittance.update({
      where: { id: remittanceId },
      data: {
        periodLabel: dto.periodLabel,
        periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : undefined,
        periodTo: dto.periodTo ? new Date(dto.periodTo) : undefined,
        declaredAmount: dto.declaredAmount,
        paidAmount: dto.paidAmount,
        devise: dto.devise,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        reference: dto.reference,
        note: dto.note,
      },
    });
  }

  private async delete(ruleId: string, remittanceId: string) {
    await this.prisma.fiscalRemittance.findFirstOrThrow({ where: { id: remittanceId, ruleId } });
    return this.prisma.fiscalRemittance.delete({ where: { id: remittanceId } });
  }
}
