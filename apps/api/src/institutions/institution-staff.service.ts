import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InviteInstitutionStaffDto } from "./dto/invite-institution-staff.dto";
import { UpdateInstitutionStaffDto } from "./dto/update-institution-staff.dto";
import { InstitutionRole, MenuInstitution, UserRole } from "@eleganz/database";
import { enregistrerAuditLog } from "../audit/audit-log.util";

const TOUS_LES_ECRANS_INSTITUTION: MenuInstitution[] = Object.values(MenuInstitution);

/**
 * Écrans de menu accordés à un rôle par défaut, tant que le profil n'a pas
 * reçu de choix explicite (16 nov. 2026) — même principe que
 * ShopsService.menuGestionParDefaut : le rôle accordé ne restreint jamais
 * le menu de force, l'ADMINISTRATEUR ou un GESTIONNAIRE_COMPTE peut
 * toujours ajuster au cas par cas via PATCH institution-portal/staff/:staffId.
 * ANALYSTE_CREDIT et CHARGE_CLIENTELE n'ont PAS accès à EQUIPE/PARAMETRES
 * par défaut ; ANALYSTE_CREDIT n'a pas DECISIONS par défaut (séparation
 * analyste/décideur demandée par le propriétaire le 16 nov. 2026 — reste
 * ajustable ici, mais la barrière de service dans DemandeCreditService
 * empêche de toute façon un même compte de valider son propre score ET de
 * rendre la décision finale sur la même demande).
 */
function menuInstitutionParDefaut(role: InstitutionRole): MenuInstitution[] {
  switch (role) {
    case InstitutionRole.ADMINISTRATEUR:
      return TOUS_LES_ECRANS_INSTITUTION;
    case InstitutionRole.GESTIONNAIRE_COMPTE:
      return [
        MenuInstitution.RECEPTION,
        MenuInstitution.ANALYSE,
        MenuInstitution.DECISIONS,
        MenuInstitution.RENDEZ_VOUS,
        MenuInstitution.PRETS,
        MenuInstitution.MESSAGERIE,
        MenuInstitution.RAPPORTS,
      ];
    case InstitutionRole.ANALYSTE_CREDIT:
      return [MenuInstitution.RECEPTION, MenuInstitution.ANALYSE, MenuInstitution.RENDEZ_VOUS, MenuInstitution.MESSAGERIE];
    case InstitutionRole.CHARGE_CLIENTELE:
      return [MenuInstitution.RECEPTION, MenuInstitution.RENDEZ_VOUS, MenuInstitution.MESSAGERIE, MenuInstitution.DECISIONS];
    case InstitutionRole.COMPTABLE:
      return [MenuInstitution.PRETS, MenuInstitution.RAPPORTS];
    default:
      return [];
  }
}

// Tableau vide sur la ligne (valeur de départ, ou remise à zéro explicite
// via PATCH) = pas de choix explicite → liste par défaut du rôle ; sinon le
// choix de l'ADMINISTRATEUR/GESTIONNAIRE_COMPTE fait foi tel quel — même
// principe que ecransEffectifs côté Gestion.
export function ecransInstitutionEffectifs(staff: { role: InstitutionRole; menuItemsOverride: MenuInstitution[] }): MenuInstitution[] {
  return staff.menuItemsOverride.length > 0 ? staff.menuItemsOverride : menuInstitutionParDefaut(staff.role);
}

/**
 * Équipe d'une institution financière (16 nov. 2026, demande du
 * propriétaire, point 2 : "l'institution doit pouvoir comme dans Gestion
 * créer les users et définir les rôles et périmètre de fonction") —
 * mirroring ShopsService.inviteStaff/listStaff/updateStaff/deactivateStaff,
 * sans limite de taille d'équipe ni de bouquet commercial (aucun modèle de
 * plan tarifaire pour les institutions à ce jour, contrairement à
 * SubscriptionPlan côté Gestion — à revoir si un tel modèle est introduit).
 */
@Injectable()
export class InstitutionStaffService {
  constructor(private readonly prisma: PrismaService) {}

  async inviteStaff(institutionId: string, dto: InviteInstitutionStaffDto, actorId: string) {
    const estEmail = dto.identifier.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. Le collaborateur doit d'abord créer son propre compte.",
      );
    }

    const existing = await this.prisma.institutionStaff.findUnique({ where: { userId: utilisateur.id } });
    let staff;
    if (existing) {
      if (existing.institutionId === institutionId) {
        if (existing.active) {
          throw new ConflictException("Cette personne fait déjà partie de votre équipe.");
        }
        // Déjà membre mais désactivé : on réactive plutôt que de dupliquer la ligne.
        staff = await this.prisma.institutionStaff.update({
          where: { id: existing.id },
          data: { active: true, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
        });
      } else {
        // Un compte ELEGANZ n'appartient qu'à une seule institution
        // (InstitutionStaff.userId @unique) — contrairement à ShopStaff, qui
        // autorise un même compte dans plusieurs équipes boutique.
        throw new ConflictException("Ce compte fait déjà partie de l'équipe d'une autre institution.");
      }
    } else {
      staff = await this.prisma.institutionStaff.create({
        data: { institutionId, userId: utilisateur.id, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
      });
    }

    // Même correctif que ShopsService.inviteStaff (19 nov. 2026) : sans
    // cette promotion, la connexion à l'espace "institution" restait
    // refusée (AuthService.login exige user.role === INSTITUTION_STAFF)
    // malgré une ligne InstitutionStaff valide.
    if (utilisateur.role !== UserRole.INSTITUTION_STAFF) {
      await this.prisma.user.update({ where: { id: utilisateur.id }, data: { role: UserRole.INSTITUTION_STAFF } });
      await enregistrerAuditLog(this.prisma, {
        actorId,
        action: "UTILISATEUR_PROMU_ACCES_INSTITUTION",
        details: { userId: utilisateur.id, institutionId, ancienRole: utilisateur.role },
      });
    }

    return staff;
  }

  async listStaff(institutionId: string) {
    const membres = await this.prisma.institutionStaff.findMany({
      where: { institutionId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
      orderBy: { createdAt: "asc" },
    });
    return membres.map((membre) => ({ ...membre, menuItems: ecransInstitutionEffectifs(membre) }));
  }

  async updateStaff(institutionId: string, staffId: string, dto: UpdateInstitutionStaffDto) {
    const staff = await this.prisma.institutionStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.institutionId !== institutionId) {
      throw new NotFoundException("Ce membre ne fait pas partie de votre institution.");
    }
    if (staff.role === InstitutionRole.ADMINISTRATEUR) {
      throw new ConflictException("Le profil de l'administrateur ne peut pas être modifié par ce chemin.");
    }
    const misAJour = await this.prisma.institutionStaff.update({
      where: { id: staffId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.menuItems !== undefined && { menuItemsOverride: dto.menuItems }),
      },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
    return { ...misAJour, menuItems: ecransInstitutionEffectifs(misAJour) };
  }

  async deactivateStaff(institutionId: string, staffId: string, actorId: string) {
    const staff = await this.prisma.institutionStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.institutionId !== institutionId) {
      throw new NotFoundException("Ce membre ne fait pas partie de votre institution.");
    }
    if (staff.role === InstitutionRole.ADMINISTRATEUR) {
      throw new ConflictException("L'administrateur de l'institution ne peut pas être retiré.");
    }
    const misAJour = await this.prisma.institutionStaff.update({
      where: { id: staffId },
      data: { active: false },
    });

    // Symétrique de la promotion ci-dessus (19 nov. 2026) — contrairement à
    // ShopStaff, InstitutionStaff.userId est unique : un compte n'appartient
    // jamais qu'à une seule institution, donc ce retrait signifie toujours
    // qu'il n'en reste plus aucune (pas de comptage à faire, à la différence
    // de retrograderSiPlusAucunRattachement côté boutique).
    const utilisateur = await this.prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });
    if (utilisateur.role === UserRole.INSTITUTION_STAFF) {
      await this.prisma.user.update({ where: { id: staff.userId }, data: { role: UserRole.BUYER } });
      await enregistrerAuditLog(this.prisma, {
        actorId,
        action: "UTILISATEUR_RETROGRADE_ACHETEUR",
        details: { userId: staff.userId, module: "institution", institutionId },
      });
    }

    return misAJour;
  }
}
