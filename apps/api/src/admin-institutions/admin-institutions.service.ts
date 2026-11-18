import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InstitutionRole, InstitutionStatus, UserRole } from "@eleganz/database";
import { CreateInstitutionDto, UpdateInstitutionDto } from "./dto/admin-institutions.dto";
import { enregistrerAuditLog } from "../audit/audit-log.util";

/**
 * Gestion des institutions partenaires (14 nov. 2026 — microfinances,
 * banques, coopératives) par un administrateur ELEGANZ. Même principe que
 * AdminTeamService.grantAdminRole pour la promotion : la personne doit
 * d'abord créer son propre compte ELEGANZ (acheteur), puis être promue ici
 * — jamais de mot de passe fixé par l'admin pour le compte de quelqu'un
 * d'autre. Contrairement à grantAdminRole, on exige ici que le compte soit
 * encore BUYER (jamais déjà vendeur/livreur/admin/autre institution) :
 * partenaire financier externe, la séparation nette d'un compte dédié
 * compte plus ici qu'en interne ELEGANZ.
 */
@Injectable()
export class AdminInstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.institution.findMany({
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, isSuspended: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: CreateInstitutionDto) {
    const estEmail = dto.identifiant.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: dto.identifiant } : { phone: dto.identifiant },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. La personne doit d'abord créer son propre compte ELEGANZ, puis être promue ici.",
      );
    }
    if (utilisateur.role !== UserRole.BUYER) {
      throw new BadRequestException(
        "Ce compte a déjà un autre rôle ELEGANZ (vendeur, livreur, admin ou institution). Demandez à la personne de créer un nouveau compte ELEGANZ dédié à cette institution.",
      );
    }
    const dejaInstitution = await this.prisma.institution.findUnique({ where: { userId: utilisateur.id } });
    if (dejaInstitution) {
      throw new ConflictException("Ce compte est déjà rattaché à une institution.");
    }

    // Transaction interactive (pas la forme tableau utilisée plus haut dans
    // ce fichier) : la ligne InstitutionStaff ci-dessous a besoin de l'id de
    // l'Institution tout juste créée — même raison et même principe que
    // InstitutionPortalService.inscrire (16 nov. 2026, gestion d'équipe) :
    // InstitutionMembershipGuard s'appuie exclusivement sur InstitutionStaff,
    // donc toute institution créée ici doit en ressortir déjà pourvue.
    const institution = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: utilisateur.id }, data: { role: UserRole.INSTITUTION_STAFF } });
      const institutionCreee = await tx.institution.create({
        data: {
          userId: utilisateur.id,
          name: dto.name,
          type: dto.type,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
        },
      });
      await tx.institutionStaff.create({
        data: { institutionId: institutionCreee.id, userId: utilisateur.id, role: InstitutionRole.ADMINISTRATEUR },
      });
      return institutionCreee;
    });
    return institution;
  }

  async update(institutionId: string, dto: UpdateInstitutionDto) {
    await this.prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
    return this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail || null }),
        ...(dto.contactPhone !== undefined && { contactPhone: dto.contactPhone || null }),
      },
    });
  }

  // Sert aussi bien à suspendre/réactiver une institution déjà active
  // qu'à APPROUVER une auto-inscription PENDING (même action côté base :
  // passer status à ACTIVE) — voir /admin/institutions/page.tsx, qui
  // affiche "Approuver" plutôt que "Réactiver" selon le statut courant.
  async setStatus(institutionId: string, status: "ACTIVE" | "SUSPENDED", adminUserId: string) {
    await this.prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
    const institution = await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        status,
        // Efface un refus précédent dès qu'un admin approuve/réactive —
        // sinon un motif de refus obsolète resterait affiché à l'institution
        // alors qu'elle est redevenue active.
        ...(status === InstitutionStatus.ACTIVE && { rejectionNote: null }),
      },
    });
    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      action: status === InstitutionStatus.ACTIVE ? "INSTITUTION_REACTIVEE" : "INSTITUTION_SUSPENDUE",
      details: { institutionId },
    });
    return institution;
  }

  // Refus explicite d'une auto-inscription (14 nov. 2026) — distinct de
  // setStatus(SUSPENDED) : une institution REJECTED n'a jamais été
  // approuvée, alors que SUSPENDED suppose qu'elle l'a été puis mise en
  // pause. Le motif, s'il est donné, est affiché tel quel à l'institution
  // sur son propre portail (voir Institution.rejectionNote).
  async reject(institutionId: string, adminUserId: string, note?: string) {
    await this.prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
    const institution = await this.prisma.institution.update({
      where: { id: institutionId },
      data: { status: InstitutionStatus.REJECTED, rejectionNote: note?.trim() || null },
    });
    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      action: "INSTITUTION_REJETEE",
      details: { institutionId, note: note?.trim() || null },
    });
    return institution;
  }

  /**
   * Rattrapage ponctuel, réservé à l'administration ELEGANZ (16 nov. 2026,
   * gestion d'équipe côté institution) — même principe que
   * AccountingService.backfillMissingSalesRevenue : crée la ligne
   * InstitutionStaff(ADMINISTRATEUR) manquante pour chaque Institution déjà
   * créée AVANT cette fonctionnalité (`create`/`inscrire` en créent déjà une
   * automatiquement depuis cette date). Idempotent : relancer ne recrée
   * rien pour une institution déjà pourvue. Action manuelle, exécutée une
   * fois au déploiement, jamais appelée automatiquement.
   */
  async backfillInstitutionStaff() {
    const institutionsSansEquipe = await this.prisma.institution.findMany({
      where: { staff: { none: {} } },
      select: { id: true, userId: true },
    });
    if (institutionsSansEquipe.length === 0) {
      return { creees: 0 };
    }
    await this.prisma.institutionStaff.createMany({
      data: institutionsSansEquipe.map((institution) => ({
        institutionId: institution.id,
        userId: institution.userId,
        role: InstitutionRole.ADMINISTRATEUR,
      })),
    });
    return { creees: institutionsSansEquipe.length };
  }
}
