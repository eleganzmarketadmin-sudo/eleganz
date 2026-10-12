import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateInvoiceSettingsDto } from "./dto/update-invoice-settings.dto";
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

  async findOne(shopId: string) {
    return this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  }

  /**
   * Identité affichée sur les documents imprimés de la boutique — chaque
   * vendeur personnalise ses propres factures/tickets/bons de livraison
   * avec ses informations (prompt du 12 oct. 2026). Un champ envoyé comme
   * chaîne vide efface l'information plutôt que de la laisser inchangée.
   */
  async updateInvoiceSettings(shopId: string, dto: UpdateInvoiceSettingsDto) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(dto.invoiceAddress !== undefined && { invoiceAddress: dto.invoiceAddress || null }),
        ...(dto.invoicePhone !== undefined && { invoicePhone: dto.invoicePhone || null }),
        ...(dto.invoiceLogoUrl !== undefined && { invoiceLogoUrl: dto.invoiceLogoUrl || null }),
        ...(dto.invoiceFooterNote !== undefined && {
          invoiceFooterNote: dto.invoiceFooterNote || null,
        }),
      },
    });
  }

  /**
   * Invite un collaborateur déjà inscrit sur ELEGANZ dans l'équipe de la
   * boutique (prompt §10 : propriétaire, gérant, caissier, magasinier,
   * responsable commercial, comptable). Chaque journal de caisse / audit
   * s'appuie ensuite sur ShopStaff.role pour savoir qui a fait quoi.
   */
  async inviteStaff(shopId: string, dto: InviteStaffDto) {
    const estEmail = dto.identifier.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. Le collaborateur doit d'abord créer son propre compte.",
      );
    }

    const existing = await this.prisma.shopStaff.findUnique({
      where: { shopId_userId: { shopId, userId: utilisateur.id } },
    });
    if (existing) {
      if (existing.active) {
        throw new ConflictException("Cette personne fait déjà partie de l'équipe de cette boutique.");
      }
      // Déjà membre mais désactivé : on réactive plutôt que de dupliquer la ligne.
      return this.prisma.shopStaff.update({
        where: { id: existing.id },
        data: { active: true, role: dto.role },
      });
    }

    return this.prisma.shopStaff.create({
      data: { shopId, userId: utilisateur.id, role: dto.role },
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

  /**
   * Retire une sélection d'articles de la Marketplace. Ne touche jamais au
   * mode de la boutique (une boutique HYBRID le reste même sans aucun
   * article publié) — seule une action explicite du propriétaire change le
   * mode.
   */
  async unpublishSelection(shopId: string, productIds: string[]) {
    await this.prisma.product.updateMany({
      where: { id: { in: productIds }, shopId },
      data: { isPublished: false },
    });
    return this.prisma.product.findMany({ where: { id: { in: productIds } } });
  }

  /**
   * Vue admin : toutes les boutiques, avec propriétaire et indicateurs
   * essentiels — support du "centre de pilotage" (prompt §40 : gestion de
   * la plateforme sans toucher au code pour les tâches courantes).
   */
  async adminListAll() {
    const shops = await this.prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        marketplaceBouquet: { select: { id: true, name: true } },
        gestionBouquet: { select: { id: true, name: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    return shops;
  }

  /**
   * Action manuelle d'un administrateur sur UNE boutique précise (à la
   * différence de BillingService.suspendOverdueShops, qui traite en masse
   * les boutiques en retard de paiement). Ne touche jamais aux commandes,
   * produits ou historiques — seulement au statut d'accès.
   */
  async adminSetStatus(shopId: string, status: ShopStatus) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({ where: { id: shopId }, data: { status } });
  }

  /**
   * Rattache une boutique à un bouquet (plan tarifaire) pour la gestion ou
   * la marketplace — permet à l'admin de changer le forfait d'un vendeur
   * sans toucher au code.
   */
  async adminSetPlan(shopId: string, kind: "gestion" | "marketplace", planId: string | null) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({
      where: { id: shopId },
      data:
        kind === "gestion"
          ? { gestionBouquetId: planId }
          : { marketplaceBouquetId: planId },
    });
  }
}
