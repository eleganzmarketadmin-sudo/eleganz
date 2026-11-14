import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InstitutionStatus, LoanDecisionStatut } from "@eleganz/database";

/**
 * Côté boutique du portail institutions (14 nov. 2026) : catalogue des
 * institutions partenaires (créées par un admin ELEGANZ, voir
 * AdminInstitutionsService), octroi/révocation d'accès à SON dossier
 * crédit, et consultation des décisions reçues. Décision verrouillée (voir
 * schema.prisma, ShopInstitutionAccess) : seule la boutique agit ici — une
 * institution ne peut jamais s'inviter elle-même.
 */
@Injectable()
export class ShopInstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Institutions partenaires actives, pour le sélecteur "partager mon dossier avec…". */
  async catalogue() {
    const institutions = await this.prisma.institution.findMany({
      where: { status: InstitutionStatus.ACTIVE },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });
    return institutions;
  }

  async mesAcces(shopId: string) {
    const acces = await this.prisma.shopInstitutionAccess.findMany({
      where: { shopId },
      include: { institution: { select: { id: true, name: true, type: true } } },
      orderBy: { createdAt: "desc" },
    });
    return acces;
  }

  async accorder(shopId: string, institutionId: string, grantedByUserId: string) {
    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution || institution.status !== InstitutionStatus.ACTIVE) {
      throw new NotFoundException("Institution introuvable ou inactive.");
    }
    const existant = await this.prisma.shopInstitutionAccess.findUnique({
      where: { shopId_institutionId: { shopId, institutionId } },
    });
    if (existant) {
      if (existant.status === "ACTIVE") {
        throw new BadRequestException("Cette institution a déjà accès à votre dossier.");
      }
      // Ré-octroi après une révocation précédente (14 nov. 2026) — on
      // réactive la même ligne plutôt que d'en créer une seconde, pour
      // conserver un historique unique par couple boutique/institution
      // (contrainte @@unique([shopId, institutionId])).
      return this.prisma.shopInstitutionAccess.update({
        where: { id: existant.id },
        data: { status: "ACTIVE", revokedAt: null, grantedByUserId },
      });
    }
    return this.prisma.shopInstitutionAccess.create({
      data: { shopId, institutionId, grantedByUserId },
    });
  }

  async revoquer(shopId: string, institutionId: string) {
    const acces = await this.prisma.shopInstitutionAccess.findUnique({
      where: { shopId_institutionId: { shopId, institutionId } },
    });
    if (!acces || acces.shopId !== shopId) {
      throw new NotFoundException("Accès introuvable.");
    }
    return this.prisma.shopInstitutionAccess.update({
      where: { id: acces.id },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
  }

  async mesDecisions(shopId: string) {
    const decisions = await this.prisma.loanDecision.findMany({
      where: { shopId },
      include: { institution: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return decisions.map((d) => ({
      ...d,
      montant: Number(d.montant),
      tauxAnnuel: Number(d.tauxAnnuel),
      // Décaissable par la boutique (FinanceController > loansObtenir avec
      // decisionId) seulement si c'est un accord pas encore décaissé.
      decaissable: d.statut === LoanDecisionStatut.ACCORDE && !d.loanId,
    }));
  }
}
