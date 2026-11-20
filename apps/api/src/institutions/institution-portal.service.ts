import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BusinessPlanService } from "../finance/business-plan.service";
import { LoansService } from "../finance/loans.service";
import { FinanceService } from "../finance/finance.service";
import { StorageService } from "../storage/storage.service";
import { recupererLogoDepuisUrl } from "../common/logo-fetch.util";
import type { IdentitePourPdf } from "../finance/dossier-credit-pdf-shared";
import { ecransInstitutionEffectifs } from "./institution-staff.service";
import { CreateLoanDecisionDto, RegisterInstitutionDto } from "./dto/institution.dto";
import { UpdateInstitutionSettingsDto } from "./dto/update-institution-settings.dto";
import { enregistrerAuditLog } from "../audit/audit-log.util";
import {
  DemandeCreditStatut,
  FiscalRuleScope,
  InstitutionRole,
  InstitutionStatus,
  LoanDecisionStatut,
  MenuInstitution,
  StatutValidationAnalyse,
} from "@eleganz/database";

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
    private readonly finance: FinanceService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Résout le profil Institution du compte connecté — jamais un id pris
   * ailleurs que le JWT. Résout en priorité via InstitutionStaff (16 nov.
   * 2026, gestion d'équipe) : c'est la seule table qui couvre aussi bien le
   * contact historique (grandfathered en ADMINISTRATEUR) que tout membre
   * invité depuis. `institution.userId` reste un filet de sécurité pour une
   * institution créée avant cette fonctionnalité et pas encore couverte par
   * le rattrapage ponctuel (AdminInstitutionsService.backfillInstitutionStaff)
   * — seulement ici, sur /me qui reste volontairement hors
   * InstitutionMembershipGuard ; les autres routes exigent, elles, que le
   * rattrapage ait déjà eu lieu.
   */
  async monProfil(userId: string) {
    const staff = await this.prisma.institutionStaff.findUnique({
      where: { userId },
      include: { institution: true },
    });
    if (staff) {
      return { ...staff.institution, monRole: staff.role, monMenu: ecransInstitutionEffectifs(staff), staffActif: staff.active };
    }
    const institution = await this.prisma.institution.findUnique({ where: { userId } });
    if (!institution) {
      throw new NotFoundException("Ce compte n'a pas de profil institution.");
    }
    return {
      ...institution,
      monRole: InstitutionRole.ADMINISTRATEUR,
      monMenu: Object.values(MenuInstitution),
      staffActif: true,
    };
  }

  /**
   * Écran Paramètres du portail (20 nov. 2026, demande : "libérer les infos
   * d'identification de l'institution [...] avec entête personnalisé et/ou
   * pied de page"). `contactEmail`/`contactPhone` n'existaient pas encore
   * comme champs éditables en libre-service — jusqu'ici fixés à
   * l'inscription (RegisterInstitutionDto) et jamais modifiables depuis le
   * portail. `name`/`type` restent volontairement hors de ce DTO (voir
   * UpdateInstitutionSettingsDto).
   */
  async mettreAJourParametres(institutionId: string, userId: string, dto: UpdateInstitutionSettingsDto) {
    const institution = await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail || null }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl || null }),
        ...(dto.headerNote !== undefined && { headerNote: dto.headerNote || null }),
        ...(dto.footerNote !== undefined && { footerNote: dto.footerNote || null }),
      },
    });
    await enregistrerAuditLog(this.prisma, {
      actorId: userId,
      action: "INSTITUTION_PARAMETRES_MODIFIES",
      details: { institutionId },
    });
    return institution;
  }

  /**
   * URL signée d'upload direct du logo vers R2 — même principe que
   * ShopsService.requestLogoUpload (shops/shops.service.ts), préfixe propre
   * à l'institution pour ne jamais mélanger les espaces de stockage.
   */
  creerUrlUploadLogo(institutionId: string, contentType: string) {
    return this.storage.creerUrlUpload(`institutions/${institutionId}/logo`, contentType);
  }

  /**
   * Identité d'institution prête à être passée aux renderers PDF du portail
   * (dossier-credit-pdf-renderer.ts en option, demande-credit-pdf-renderer.ts
   * et rapport-portefeuille-pdf-renderer.ts en obligatoire) — centralise la
   * récupération du logo (recupererLogoDepuisUrl, avec son garde-fou de
   * taille/délai) pour que chaque route d'export n'ait qu'à appeler cette
   * seule méthode plutôt que de redupliquer la logique de fetch.
   */
  async identitePourPdf(institutionId: string): Promise<IdentitePourPdf> {
    const institution = await this.prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
    const logo = await recupererLogoDepuisUrl(institution.logoUrl);
    return {
      name: institution.name,
      logo,
      address: institution.address,
      headerNote: institution.headerNote,
      footerNote: institution.footerNote,
    };
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
    // Crée dans la même transaction la ligne InstitutionStaff(ADMINISTRATEUR)
    // de ce contact (16 nov. 2026, gestion d'équipe) — InstitutionMembershipGuard
    // s'appuie exclusivement sur InstitutionStaff, jamais sur
    // Institution.userId directement, donc toute nouvelle institution doit en
    // ressortir déjà pourvue, même encore PENDING.
    return this.prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          userId,
          name: dto.name,
          type: dto.type,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          status: InstitutionStatus.PENDING,
        },
      });
      await tx.institutionStaff.create({
        data: { institutionId: institution.id, userId, role: InstitutionRole.ADMINISTRATEUR },
      });
      return institution;
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

  /**
   * Dossier consulté par une institution sur une boutique qui lui a
   * accordé l'accès. Enrichi le 16 nov. 2026 : avant cette date, seul le
   * narratif BusinessPlan était renvoyé — jamais les vrais chiffres
   * financiers de la boutique. `financier` reste une lecture LIVE (donc
   * potentiellement différente du snapshot figé dans une DemandeCredit déjà
   * soumise, voir DemandeCreditService) : utile pour une première
   * consultation avant toute soumission, ou pour suivre l'évolution d'une
   * boutique entre deux demandes.
   */
  async dossier(institutionId: string, shopId: string) {
    await this.verifierAcces(institutionId, shopId);
    const [businessPlan, financier] = await Promise.all([
      this.businessPlan.obtenir(FiscalRuleScope.SHOP, shopId),
      this.finance.dossierCredit(shopId),
    ]);
    return { businessPlan, financier };
  }

  /**
   * Enregistre le verdict final d'une institution. Depuis le 16 nov. 2026,
   * `dto.demandeCreditId` (optionnel) rattache cette décision à une
   * candidature numérotée (voir DemandeCredit) : vérifiée ici pour
   * appartenir bien à cette institution et cette boutique, puis refermée
   * sur ACCORDEE/REFUSEE — jamais une resaisie manuelle, pour que le statut
   * de la demande reste toujours le reflet exact de la dernière décision
   * prise sur elle.
   *
   * Double contrôle RÉEL (chantier "gestion de risque autonome", 16 nov.
   * 2026, demande verrouillée du propriétaire) — jusqu'ici seulement
   * documentée en commentaire sur InstitutionRole.ANALYSTE_CREDIT sans être
   * appliquée : voir le bloc ci-dessous.
   */
  async decider(institutionId: string, shopId: string, userId: string, dto: CreateLoanDecisionDto) {
    await this.verifierAcces(institutionId, shopId);

    if (dto.demandeCreditId) {
      const demande = await this.prisma.demandeCredit.findUnique({
        where: { id: dto.demandeCreditId },
        include: { analyse: true },
      });
      if (!demande || demande.institutionId !== institutionId || demande.shopId !== shopId) {
        throw new ForbiddenException("Cette demande de crédit n'appartient pas à cette boutique et à votre institution.");
      }

      // Une candidature avec dossier financier rattaché (shopId renseigné,
      // donc un snapshot existe forcément — voir DemandeCreditService.soumettre)
      // exige une AnalyseCredit VALIDEE avant toute décision, et jamais par
      // la même personne qui l'a validée. Une candidature "libre" (shopId
      // null, voir DemandeCreditService.creerLibre) n'a pas de snapshot,
      // donc aucun score automatique n'est calculable (AnalyseCredit.analysable=false
      // si une analyse y a quand même été tentée) : elle reste décidable
      // directement, après revue manuelle du dossier.
      if (demande.shopId) {
        if (!demande.analyse || demande.analyse.statutValidation !== StatutValidationAnalyse.VALIDEE) {
          throw new BadRequestException(
            "L'analyse de crédit de cette candidature doit être calculée puis validée par un analyste avant toute décision.",
          );
        }
        if (demande.analyse.valideParUserId === userId) {
          throw new ForbiddenException(
            "Vous avez validé l'analyse de crédit de cette candidature : la décision finale doit être prise par une autre personne (séparation analyste/décideur).",
          );
        }
      }
    }

    const decision = await this.prisma.loanDecision.create({
      data: {
        shopId,
        institutionId,
        demandeCreditId: dto.demandeCreditId,
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

    if (dto.demandeCreditId) {
      await this.prisma.demandeCredit.update({
        where: { id: dto.demandeCreditId },
        data: { statut: dto.statut === "ACCORDE" ? DemandeCreditStatut.ACCORDEE : DemandeCreditStatut.REFUSEE },
      });
    }

    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: userId,
      shopId,
      action: "DECISION_CREDIT",
      details: {
        institutionId,
        demandeCreditId: dto.demandeCreditId ?? null,
        statut: dto.statut,
        montant: dto.montant,
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
