import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ecransAdminEffectifs } from "../admin-team/menu-admin.util";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new ConflictException("Un email ou un numéro de téléphone est requis.");
    }

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as object[],
      },
    });
    if (existing) {
      throw new ConflictException("Un compte existe déjà avec cet email ou ce numéro.");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
      },
    });

    return this.issueToken(user.id, user.role);
  }

  async login(dto: LoginDto) {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException("Identifiants invalides.");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as object[],
      },
    });

    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      // Message volontairement générique : ne pas révéler si c'est l'identifiant ou le mot de passe qui est faux.
      throw new UnauthorizedException("Identifiants invalides.");
    }

    if (user.isSuspended) {
      throw new UnauthorizedException(
        "Ce compte a été suspendu. Contactez le support ELEGANZ pour plus d'informations.",
      );
    }

    // Cloisonnement par espace (demande du 10 nov. 2026, point 5) — vérifié
    // ICI, avant `issueToken`, pour qu'un compte créé dans un autre module
    // ne reparte jamais avec une session valable pour celui-ci, même
    // stockée sous une mauvaise clé côté front. `dto.espace` absent (cas de
    // /marketplace/compte) reste volontairement sans restriction.
    // `dto.espace === "comptable"` (Mon assistant/Secourable, 11 nov. 2026)
    // n'ajoute aucune restriction non plus — Secourable reste ouvert à tout
    // compte ELEGANZ par choix de conception — il ne fait que transiter ici
    // pour que la connexion dédiée (/comptable/connexion) redevienne requise
    // malgré l'absence de contrôle de rôle, voir espaceAuth() côté front.
    if (dto.espace === "admin" && !user.role.startsWith("ADMIN_")) {
      throw new UnauthorizedException(
        "Ce compte n'a pas accès au Centre de pilotage ELEGANZ.",
      );
    }
    if (dto.espace === "livreur" && user.role !== "DRIVER") {
      throw new UnauthorizedException(
        "Ce compte n'est pas un compte livreur ELEGANZ.",
      );
    }
    if (dto.espace === "gestion" && user.role !== "SHOP_OWNER" && user.role !== "SHOP_STAFF") {
      throw new UnauthorizedException(
        "Ce compte n'a pas accès à ELEGANZ Gestion.",
      );
    }
    // Portail institutions (14 nov. 2026) — même cloisonnement que livreur/admin/gestion ci-dessus.
    if (dto.espace === "institution" && user.role !== "INSTITUTION_STAFF") {
      throw new UnauthorizedException(
        "Ce compte n'a pas accès au portail institutions ELEGANZ.",
      );
    }

    return this.issueToken(user.id, user.role);
  }

  private async issueToken(userId: string, role: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId, role });
    return { accessToken };
  }

  // Profil du compte connecté (prompt du 15 oct. 2026, point 2 — page "Mon
  // profil" Marketplace) — n'expose que des champs d'identité, jamais le
  // mot de passe ni un champ interne à un autre espace (boutique, livreur…).
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, fullName: true, email: true, phone: true, role: true, adminMenuItemsOverride: true },
    });
    if (!user) {
      throw new UnauthorizedException("Compte introuvable.");
    }
    const { adminMenuItemsOverride, ...reste } = user;
    // `adminMenuItems` (16 oct. 2026 — permissions de menu par compte admin)
    // : calculé seulement pour un compte ADMIN_*, pour qu'AdminShell filtre
    // son menu sur la vraie valeur effective plutôt que sur sa seule table
    // de secours par rôle (confort de navigation uniquement — la vraie
    // barrière reste à construire contrôleur par contrôleur côté API).
    return {
      ...reste,
      adminMenuItems: user.role.startsWith("ADMIN_") ? ecransAdminEffectifs({ role: user.role, adminMenuItemsOverride }) : undefined,
    };
  }

  // Mise à jour du profil personnel (demande du 16 oct. 2026, point 2) —
  // disponible depuis n'importe quel espace (Marketplace, Gestion, Mon
  // assistant, Livreur, Admin), puisque le compte ELEGANZ est commun à tous.
  async updateMe(userId: string, dto: UpdateMeDto) {
    if (dto.email || dto.phone) {
      const conflit = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          OR: [
            dto.email ? { email: dto.email } : undefined,
            dto.phone ? { phone: dto.phone } : undefined,
          ].filter(Boolean) as object[],
        },
      });
      if (conflit) {
        throw new ConflictException("Un autre compte utilise déjà cet email ou ce numéro.");
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
      select: { id: true, fullName: true, email: true, phone: true, role: true },
    });
    return user;
  }

  // Changement de mot de passe (demande du 10 nov. 2026, point 3) —
  // revérifie l'ancien mot de passe avant d'accepter le nouveau, pour
  // qu'une session volée (token encore valide, machine laissée ouverte) ne
  // suffise pas à elle seule à prendre le contrôle du compte.
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Le mot de passe actuel est incorrect.");
    }
    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel.");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }
}
