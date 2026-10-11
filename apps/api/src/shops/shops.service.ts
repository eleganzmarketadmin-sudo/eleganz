import { ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { ShopStatus, StaffRole } from "@eleganz/database";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerId: string, dto: CreateShopDto) {
    const baseSlug = slugify(dto.name);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    // Décision #3 : période gratuite par défaut 3 mois, démarrée à la création
    // (« l'entrée en relation »), mais modifiable ensuite depuis l'admin.
    const shop = await this.prisma.shop.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        mode: dto.mode,
        status: ShopStatus.FREE_PERIOD,
        freeTrialStartedAt: new Date(),
        freeTrialDurationDays: 90,
        openingFeeWaived: true,
        staff: {
          create: {
            userId: ownerId,
            role: StaffRole.OWNER,
          },
        },
      },
    });

    return shop;
  }

  /**
   * Boutiques accessibles à l'utilisateur : celles qu'il possède, mais aussi
   * celles où il est simplement membre de l'équipe (caissier, gérant, ...) —
   * un caissier n'est jamais propriétaire mais doit voir la boutique où il
   * travaille pour ouvrir la caisse.
   */
  async findMine(userId: string) {
    return this.prisma.shop.findMany({
      where: {
        OR: [{ ownerId: userId }, { staff: { some: { userId, active: true } } }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Invite un collaborateur déjà inscrit sur ELEGANZ dans l'équipe de la
   * boutique (prompt §10 : propriétaire, gérant, caissier, magasinier,
   * responsable commercial, comptable). Chaque journal de caisse / audit
   * s'appuie ensuite sur ShopStaff.role pour savoir qui a fait quoi.
   */
  async inviteStaff(shopId: string, dto: InviteStaffDto) {
    const existing = await this.prisma.shopStaff.findUnique({
      where: { shopId_userId: { shopId, userId: dto.userId } },
    });
    if (existing) {
      throw new ConflictException("Cet utilisateur fait déjà partie de l'équipe de cette boutique.");
    }

    return this.prisma.shopStaff.create({
      data: { shopId, userId: dto.userId, role: dto.role },
    });
  }

  listStaff(shopId: string) {
    return this.prisma.shopStaff.findMany({
      where: { shopId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
  }

  async deactivateStaff(shopId: string, staffId: string) {
    const staff = await this.prisma.shopStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.role === StaffRole.OWNER) {
      throw new ConflictException("Le propriétaire de la boutique ne peut pas être retiré.");
    }
    return this.prisma.shopStaff.update({ where: { id: staffId }, data: { active: false } });
  }

  /**
   * Publication volontaire d'une sélection de produits sur la Marketplace
   * (complément stratégique §12). Ne touche jamais aux données de gestion privées.
   */
  async publishSelection(shopId: string, productIds: string[]) {
    await this.prisma.product.updateMany({
      where: { id: { in: productIds }, shopId },
      data: { isPublished: true },
    });

    const shop = await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    if (shop.mode === "PRIVATE") {
      await this.prisma.shop.update({
        where: { id: shopId },
        data: { mode: "HYBRID", isPubliclyListed: true },
      });
    }

    return this.prisma.product.findMany({ where: { id: { in: productIds } } });
  }
}
