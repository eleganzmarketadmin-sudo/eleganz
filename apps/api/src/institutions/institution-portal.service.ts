import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BusinessPlanService } from "../finance/business-plan.service";
import { LoansService } from "../finance/loans.service";
import { CreateLoanDecisionDto } from "./dto/institution.dto";
import { FiscalRuleScope, LoanDecisionStatut } from "@eleganz/database";

/**
 * Côté institution du portail (14 nov. 2026) : une institution ne voit
 * jamais plus qu'une boutique ne lui a explicitement partagé (voir
 * ShopInstitutionAccess) — chaque méthode revérifie cet accès elle-même,
 * jamais seulement l'affichage côté écran (même exigence que partout
 * ailleurs dans l'API, prompt maître §11).
 */
@Injectable()
export class InstitutionPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businessPlan: BusinessPlanService,
    private readonly loans: LoansService,
  ) {}

  /** Résout le profil Institution du compte connecté — jamais un id pris ailleurs que le JWT. */
  async monProfil(userId: string) {
    const institution = await this.prisma.institution.findUnique({ where: { userId } });
    if (!institution) {
      throw new NotFoundException("Ce compte n'a pas de profil institution.");
    }
    return institution;
  }

  private async verifierAcces(institutionId: string, shopId: string) {
    const acces = await this.prisma.shopInstitutionAccess.findUnique({
      where: { shopId_institutionId: { shopId, institutionId } },
    });
    if (!acces || acces.status !== "ACTIVE") {
      throw new ForbiddenException("Cette boutique ne vous a pas (ou plus) partagé son dossier.");
    }
    return acces;
  }

  async mesBoutiques(institutionId: string) {
    const acces = await this.prisma.shopInstitutionAccess.findMany({
      where: { institutionId, status: "ACTIVE" },
      include: { shop: { select: { id: true, name: true, slug: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });
    return acces.map((a) => a.shop);
  }

  async dossier(institutionId: string, shopId: string) {
    await this.verifierAcces(institutionId, shopId);
    return this.businessPlan.obtenir(FiscalRuleScope.SHOP, shopId);
  }

  async decider(institutionId: string, shopId: string, userId: string, dto: CreateLoanDecisionDto) {
    await this.verifierAcces(institutionId, shopId);
    const decision = await this.prisma.loanDecision.create({
      data: {
        shopId,
        institutionId,
        scenarioId: dto.scenarioId,
        statut: dto.statut === "ACCORDE" ? LoanDecisionStatut.ACCORDE : LoanDecisionStatut.REFUSE,
        montant: dto.montant,
        tauxAnnuel: dto.tauxAnnuel,
        dureeMois: dto.dureeMois,
        note: dto.note,
        autoriserSuiviRemboursement: dto.autoriserSuiviRemboursement ?? false,
        decidedByUserId: userId,
      },
    });
    return { ...decision, montant: Number(decision.montant), tauxAnnuel: Number(decision.tauxAnnuel) };
  }

  async mesDecisions(institutionId: string) {
    const decisions = await this.prisma.loanDecision.findMany({
      where: { institutionId },
      include: { shop: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
    return decisions.map((d) => ({ ...d, montant: Number(d.montant), tauxAnnuel: Number(d.tauxAnnuel) }));
  }

  mesPrets(institutionId: string) {
    return this.loans.listForInstitution(institutionId);
  }

  async comptabiliserEcheance(institutionId: string, shopId: string, loanId: string, periode?: string) {
    await this.verifierAcces(institutionId, shopId);
    return this.loans.comptabiliserEcheanceViaInstitution(institutionId, shopId, loanId, periode);
  }

  async listerEcheances(institutionId: string, shopId: string, loanId: string) {
    await this.verifierAcces(institutionId, shopId);
    return this.loans.listerEcheancesViaInstitution(institutionId, shopId, loanId);
  }
}
