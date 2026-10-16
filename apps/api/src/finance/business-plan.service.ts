import { Injectable, NotFoundException } from "@nestjs/common";
import { FiscalRuleScope } from "@eleganz/database";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateBusinessPlanDto, CreateLoanScenarioDto, UpdateLoanScenarioDto } from "./dto/business-plan.dto";

/**
 * Business plan et scénarios de prêt (16 oct. 2026, point 1) — reprend le
 * patron déjà validé pour FiscalRule/Account : un seul service, séparé par
 * scope (SHOP/PLATFORM) + shopId nullable, isolation imposée ici même
 * (jamais seulement par l'affichage). scope=SHOP, shopId défini → business
 * plan d'une boutique ; scope=PLATFORM, shopId=null → business plan
 * d'ELEGANZ elle-même (singleton applicatif, voir `obtenirOuCreerPlan`).
 *
 * Alimente le dossier crédit (boutique et plateforme, FinanceService /
 * AdminFinanceService) et le futur rapport annuel.
 */
@Injectable()
export class BusinessPlanService {
  constructor(private readonly prisma: PrismaService) {}

  /** Calcule la mensualité d'un prêt par amortissement constant (formule standard). */
  static mensualite(montant: number, tauxAnnuel: number, dureeMois: number): number {
    const r = tauxAnnuel / 100 / 12;
    if (r === 0) return dureeMois > 0 ? montant / dureeMois : 0;
    const facteur = Math.pow(1 + r, dureeMois);
    return (montant * r * facteur) / (facteur - 1);
  }

  async obtenir(scope: FiscalRuleScope, shopId: string | null) {
    const plan = await this.prisma.businessPlan.findFirst({
      where: { scope, shopId },
      include: { scenarios: { orderBy: { createdAt: "asc" } } },
    });
    if (!plan) {
      return {
        id: null as string | null,
        scope,
        shopId,
        resumeExecutif: null,
        descriptionActivite: null,
        marcheEtClientele: null,
        strategieCroissance: null,
        utilisationFonds: null,
        risquesMitigation: null,
        updatedAt: null as string | null,
        scenarios: [] as { id: string; label: string; montant: number; tauxAnnuel: number; dureeMois: number; objetFinancement: string | null; mensualite: number }[],
      };
    }
    return {
      ...plan,
      scenarios: plan.scenarios.map((s) => ({
        id: s.id,
        label: s.label,
        montant: Number(s.montant),
        tauxAnnuel: Number(s.tauxAnnuel),
        dureeMois: s.dureeMois,
        objetFinancement: s.objetFinancement,
        mensualite: BusinessPlanService.mensualite(Number(s.montant), Number(s.tauxAnnuel), s.dureeMois),
      })),
    };
  }

  private async obtenirOuCreerPlan(scope: FiscalRuleScope, shopId: string | null) {
    const existant = await this.prisma.businessPlan.findFirst({ where: { scope, shopId } });
    if (existant) return existant;
    return this.prisma.businessPlan.create({ data: { scope, shopId } });
  }

  async enregistrer(scope: FiscalRuleScope, shopId: string | null, dto: UpdateBusinessPlanDto) {
    const plan = await this.obtenirOuCreerPlan(scope, shopId);
    await this.prisma.businessPlan.update({ where: { id: plan.id }, data: dto });
    return this.obtenir(scope, shopId);
  }

  async ajouterScenario(scope: FiscalRuleScope, shopId: string | null, dto: CreateLoanScenarioDto) {
    const plan = await this.obtenirOuCreerPlan(scope, shopId);
    await this.prisma.loanScenario.create({ data: { businessPlanId: plan.id, ...dto } });
    return this.obtenir(scope, shopId);
  }

  private async scenarioScope(scope: FiscalRuleScope, shopId: string | null, scenarioId: string) {
    const scenario = await this.prisma.loanScenario.findFirst({
      where: { id: scenarioId, businessPlan: { scope, shopId } },
    });
    if (!scenario) throw new NotFoundException("Scénario introuvable pour ce périmètre.");
    return scenario;
  }

  async modifierScenario(scope: FiscalRuleScope, shopId: string | null, scenarioId: string, dto: UpdateLoanScenarioDto) {
    await this.scenarioScope(scope, shopId, scenarioId);
    await this.prisma.loanScenario.update({ where: { id: scenarioId }, data: dto });
    return this.obtenir(scope, shopId);
  }

  async supprimerScenario(scope: FiscalRuleScope, shopId: string | null, scenarioId: string) {
    await this.scenarioScope(scope, shopId, scenarioId);
    await this.prisma.loanScenario.delete({ where: { id: scenarioId } });
    return this.obtenir(scope, shopId);
  }
}
