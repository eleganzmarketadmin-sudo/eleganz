import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InviteInstitutionStaffDto } from "./dto/invite-institution-staff.dto";
import { UpdateInstitutionStaffDto } from "./dto/update-institution-staff.dto";
import { InstitutionRole, MenuInstitution } from "@eleganz/database";

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

  async inviteStaff(institutionId: string, dto: InviteInstitutionStaffDto) {
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
    if (existing) {
      if (existing.institutionId === institutionId) {
        if (existing.active) {
          throw new ConflictException("Cette personne fait déjà partie de votre équipe.");
        }
        // Déjà membre mais désactivé : on réactive plutôt que de dupliquer la ligne.
        return this.prisma.institutionStaff.update({
          where: { id: existing.id },
          data: { active: true, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
        });
      }
      // Un compte ELEGANZ n'appartient qu'à une seule institution
      // (InstitutionStaff.userId @unique) — contrairement à ShopStaff, qui
      // autorise un même compte dans plusieurs équipes boutique.
      throw new ConflictException("Ce compte fait déjà partie de l'équipe d'une autre institution.");
    }

    return this.prisma.institutionStaff.create({
      data: { institutionId, userId: utilisateur.id, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
    });
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

  async deactivateStaff(institutionId: string, staffId: string) {
    const staff = await this.prisma.institutionStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.institutionId !== institutionId) {
      throw new NotFoundException("Ce membre ne fait pas partie de votre institution.");
    }
    if (staff.role === InstitutionRole.ADMINISTRATEUR) {
      throw new ConflictException("L'administrateur de l'institution ne peut pas être retiré.");
    }
    return this.prisma.institutionStaff.update({ where: { id: staffId }, data: { active: false } });
  }
}
