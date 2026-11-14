import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BusinessPlanService } from "../finance/business-plan.service";
import { LoansService } from "../finance/loans.service";
import { CreateLoanDecisionDto, RegisterInstitutionDto } from "./dto/institution.dto";
import { FiscalRuleScope, InstitutionStatus, LoanDecisionStatut } from "@eleganz/database";

/**
 * Garde réutilisée par chaque méthode du portail ci-dessous qui donne accès
 * à un contenu réel (jamais par `monProfil`/`me` tout seul, ni par
 * `inscrire` — une institution doit pouvoir consulter son propre statut et
 * s'inscrire sans déjà être active). Distincte d'un rôle Nest : le statut
 * d'une Institution change dans le temps (PENDING → ACTIVE/REJECTED,
 * ACTIVE ↔ SUSPENDED), contrairement au rôle du compte, fixé une fois pour
 * toutes à l'inscription.
 */
export function exigerInstitutionActive(institution: { status: InstitutionStatus }): void {
  if (institution.status === InstitutionStatus.ACTIVE) return;
  const messages: Record<string, string> = {
    [InstitutionStatus.PENDING]: "Votre inscription est en attente de validation par l'équipe ELEGANZ.",
    [InstitutionStatus.REJECTED]: "Votre demande d'inscription en tant qu'institution partenaire a été refusée par ELEGANZ.",
    [InstitutionStatus.SUSPENDED]: "Votre compte institution a été suspendu par ELEGANZ.",
  };
  throw new ForbiddenException(messages[institution.status] ?? "Votre compte institution n'est pas actif.");
}

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

  // Auto-inscription (14 nov. 2026, revirement sur la décision initiale
  // "sur invitation uniquement") — le compte ELEGANZ (role=INSTITUTION_STAFF)
  // existe déjà à cet instant (voir RegisterInstitutionDto) ; ce profil est
  // toujours créé au statut PENDING, jamais ACTIVE directement : seul un
  // admin ELEGANZ peut l'activer (AdminInstitutionsService.setStatus) ou le
  // refuser (AdminInstitutionsService.reject).
  async inscrire(userId: string, dto: RegisterInstitutionDto) {
    const dejaExistant = await this.prisma.institution.findUnique({ where: { userId } });
    if (dejaExistant) {
      throw new ConflictException("Ce compte a déjà un profil institution.");
    }
    return this.prisma.institution.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        status: InstitutionStatus.PENDING,
      },
    });
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
