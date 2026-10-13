import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FiscalRuleScope, FiscalRuleStatus } from "@eleganz/database";
import { CreateFiscalRuleDto, UpdateFiscalRuleDto } from "./dto/fiscal-rule.dto";

/**
 * Règles fiscales à 3 niveaux (prompt du 13 oct. 2026, §5 et §15) — une seule
 * table FiscalRule, séparée par `scope` (SHOP/PLATFORM) ; voir
 * docs/ARCHITECTURE_FINANCE.md §3.2 pour la justification de ce choix et la
 * garantie que la séparation est imposée ici (service), jamais seulement par
 * l'affichage. Chaque méthode "shop" filtre systématiquement sur
 * `scope: SHOP, shopId` ; chaque méthode "platform" filtre systématiquement
 * sur `scope: PLATFORM` — jamais l'un ne peut lire/écrire l'autre.
 */
@Injectable()
export class FiscalRulesService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  listForShop(shopId: string) {
    return this.prisma.fiscalRule.findMany({
      where: { scope: FiscalRuleScope.SHOP, shopId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createForShop(shopId: string, authorId: string, dto: CreateFiscalRuleDto) {
    const { motif, ...champs } = dto;
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.fiscalRule.create({
        data: {
          scope: FiscalRuleScope.SHOP,
          shopId,
          label: champs.label,
          category: champs.category,
          rateOrFormula: champs.rateOrFormula,
          baseCalcul: champs.baseCalcul,
          champApplication: champs.champApplication,
          regime: champs.regime,
          effectiveFrom: new Date(champs.effectiveFrom),
          effectiveTo: champs.effectiveTo ? new Date(champs.effectiveTo) : undefined,
          sourceReference: champs.sourceReference,
          // Une règle créée par la boutique elle-même n'est jamais
          // automatiquement "vérifiée" (§5.5) — elle part toujours au
          // statut CONFIGUREE (configurée par l'entreprise), jamais VERIFIEE.
          status: FiscalRuleStatus.CONFIGUREE,
          lastModifiedBy: authorId,
        },
      });
      await tx.fiscalRuleVersion.create({
        data: {
          ruleId: rule.id,
          oldValue: undefined,
          newValue: rule as unknown as object,
          authorId,
          motif,
          effectiveDate: rule.effectiveFrom,
          status: rule.status,
        },
      });
      return rule;
    });
  }

  async updateForShop(shopId: string, ruleId: string, authorId: string, dto: UpdateFiscalRuleDto) {
    const { motif, ...champs } = dto;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fiscalRule.findFirstOrThrow({
        where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId },
      });
      const updated = await tx.fiscalRule.update({
        where: { id: ruleId },
        data: {
          ...champs,
          effectiveFrom: champs.effectiveFrom ? new Date(champs.effectiveFrom) : undefined,
          effectiveTo: champs.effectiveTo ? new Date(champs.effectiveTo) : undefined,
          lastModifiedBy: authorId,
        },
      });
      await tx.fiscalRuleVersion.create({
        data: {
          ruleId,
          oldValue: existing as unknown as object,
          newValue: updated as unknown as object,
          authorId,
          motif,
          effectiveDate: updated.effectiveFrom,
          status: updated.status,
        },
      });
      return updated;
    });
  }

  async archiveForShop(shopId: string, ruleId: string, authorId: string, motif: string) {
    await this.prisma.fiscalRule.findFirstOrThrow({
      where: { id: ruleId, scope: FiscalRuleScope.SHOP, shopId },
    });
    return this.setStatus(ruleId, FiscalRuleStatus.OBSOLETE, authorId, motif);
  }

  versionsForShopRule(shopId: string, ruleId: string) {
    return this.prisma.fiscalRuleVersion.findMany({
      where: { ruleId, rule: { scope: FiscalRuleScope.SHOP, shopId } },
      orderBy: { createdAt: "desc" },
    });
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  listForPlatform() {
    return this.prisma.fiscalRule.findMany({
      where: { scope: FiscalRuleScope.PLATFORM },
      orderBy: { createdAt: "desc" },
    });
  }

  async createForPlatform(authorId: string, dto: CreateFiscalRuleDto) {
    const { motif, ...champs } = dto;
    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.fiscalRule.create({
        data: {
          scope: FiscalRuleScope.PLATFORM,
          shopId: null,
          label: champs.label,
          category: champs.category,
          rateOrFormula: champs.rateOrFormula,
          baseCalcul: champs.baseCalcul,
          champApplication: champs.champApplication,
          regime: champs.regime,
          effectiveFrom: new Date(champs.effectiveFrom),
          effectiveTo: champs.effectiveTo ? new Date(champs.effectiveTo) : undefined,
          sourceReference: champs.sourceReference,
          status: FiscalRuleStatus.CONFIGUREE,
          lastModifiedBy: authorId,
        },
      });
      await tx.fiscalRuleVersion.create({
        data: {
          ruleId: rule.id,
          oldValue: undefined,
          newValue: rule as unknown as object,
          authorId,
          motif,
          effectiveDate: rule.effectiveFrom,
          status: rule.status,
        },
      });
      return rule;
    });
  }

  async updateForPlatform(ruleId: string, authorId: string, dto: UpdateFiscalRuleDto) {
    const { motif, ...champs } = dto;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fiscalRule.findFirstOrThrow({
        where: { id: ruleId, scope: FiscalRuleScope.PLATFORM },
      });
      const updated = await tx.fiscalRule.update({
        where: { id: ruleId },
        data: {
          ...champs,
          effectiveFrom: champs.effectiveFrom ? new Date(champs.effectiveFrom) : undefined,
          effectiveTo: champs.effectiveTo ? new Date(champs.effectiveTo) : undefined,
          lastModifiedBy: authorId,
        },
      });
      await tx.fiscalRuleVersion.create({
        data: {
          ruleId,
          oldValue: existing as unknown as object,
          newValue: updated as unknown as object,
          authorId,
          motif,
          effectiveDate: updated.effectiveFrom,
          status: updated.status,
        },
      });
      return updated;
    });
  }

  versionsForPlatformRule(ruleId: string) {
    return this.prisma.fiscalRuleVersion.findMany({
      where: { ruleId, rule: { scope: FiscalRuleScope.PLATFORM } },
      orderBy: { createdAt: "desc" },
    });
  }

  private async setStatus(ruleId: string, status: FiscalRuleStatus, authorId: string, motif: string) {
    const existing = await this.prisma.fiscalRule.findUniqueOrThrow({ where: { id: ruleId } });
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.fiscalRule.update({
        where: { id: ruleId },
        data: { status, lastModifiedBy: authorId },
      });
      await tx.fiscalRuleVersion.create({
        data: {
          ruleId,
          oldValue: existing as unknown as object,
          newValue: updated as unknown as object,
          authorId,
          motif,
          effectiveDate: new Date(),
          status,
        },
      });
      return updated;
    });
  }
}
