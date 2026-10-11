import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateShopDto } from "./dto/create-shop.dto";
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

  async findMine(ownerId: string) {
    return this.prisma.shop.findMany({ where: { ownerId } });
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
