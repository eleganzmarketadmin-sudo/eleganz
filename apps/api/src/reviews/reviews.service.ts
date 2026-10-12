import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { OrderStatus } from "@eleganz/database";

const STATUTS_ACHAT_VERIFIE: OrderStatus[] = [OrderStatus.RECEIVED_CONFIRMED, OrderStatus.CLOSED];

/**
 * Avis, commentaires et témoignages (prompt du 12 oct. 2026) — renforcent la
 * crédibilité de la Marketplace. Un avis cible toujours une boutique, avec en
 * option un article précis et une commande précise. N'importe quel acheteur
 * connecté peut laisser un avis (on ne veut pas bloquer un retour honnête
 * faute d'avoir retrouvé la bonne commande), mais seul un avis réellement
 * rattaché à une commande de cet acheteur, livrée et confirmée, porte le
 * badge "achat vérifié" — jamais déduit de la seule déclaration du client.
 */
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(shopId: string, authorId: string, dto: CreateReviewDto) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
      throw new NotFoundException("Boutique introuvable.");
    }

    if (dto.productId) {
      const produit = await this.prisma.product.findFirst({ where: { id: dto.productId, shopId } });
      if (!produit) {
        throw new BadRequestException("Cet article n'appartient pas à cette boutique.");
      }
    }

    let verifiedPurchase = false;
    if (dto.shopOrderId) {
      const shopOrder = await this.prisma.shopOrder.findFirst({
        where: { id: dto.shopOrderId, shopId },
        include: { order: { select: { buyerId: true } } },
      });
      if (!shopOrder) {
        throw new BadRequestException("Cette commande n'appartient pas à cette boutique.");
      }
      if (shopOrder.order.buyerId !== authorId) {
        throw new ForbiddenException("Cette commande n'est pas la vôtre.");
      }
      verifiedPurchase = STATUTS_ACHAT_VERIFIE.includes(shopOrder.status);
    }

    try {
      return await this.prisma.review.create({
        data: {
          shopId,
          productId: dto.productId,
          shopOrderId: dto.shopOrderId,
          authorId,
          rating: dto.rating,
          comment: dto.comment,
          verifiedPurchase,
        },
        include: { author: { select: { fullName: true } } },
      });
    } catch (err) {
      // Contrainte @@unique([authorId, shopOrderId]) — un seul avis par
      // commande, pour empêcher de gonfler artificiellement la note.
      if (dto.shopOrderId) {
        throw new BadRequestException("Vous avez déjà laissé un avis pour cette commande.");
      }
      throw err;
    }
  }

  async listForShop(shopId: string, productId?: string) {
    const avis = await this.prisma.review.findMany({
      where: { shopId, isPublished: true, ...(productId ? { productId } : {}) },
      include: { author: { select: { fullName: true } }, product: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });

    const total = avis.length;
    const moyenne = total > 0 ? avis.reduce((s, a) => s + a.rating, 0) / total : 0;

    return {
      moyenne: Math.round(moyenne * 10) / 10,
      total,
      avis: avis.map((a) => ({
        id: a.id,
        rating: a.rating,
        comment: a.comment,
        verifiedPurchase: a.verifiedPurchase,
        createdAt: a.createdAt,
        auteur: a.author.fullName,
        produit: a.product ? { id: a.product.id, nom: a.product.name } : null,
      })),
    };
  }

  /** Avis les plus récents toutes boutiques confondues — pour la section "Témoignages" de la vitrine. */
  async listTemoignages(limite = 6) {
    const avis = await this.prisma.review.findMany({
      where: { isPublished: true, comment: { not: null } },
      include: { author: { select: { fullName: true } }, shop: { select: { name: true } } },
      orderBy: [{ rating: "desc" }, { createdAt: "desc" }],
      take: limite,
    });
    return avis.map((a) => ({
      id: a.id,
      rating: a.rating,
      comment: a.comment,
      verifiedPurchase: a.verifiedPurchase,
      auteur: a.author.fullName,
      boutique: a.shop.name,
    }));
  }

  /**
   * Commandes de l'acheteur, chez cette boutique, pour lesquelles il n'a pas
   * encore laissé d'avis — alimente le choix "lier à votre commande" côté
   * écran sans que l'acheteur ait à retenir un identifiant.
   */
  async commandesAvisables(shopId: string, authorId: string) {
    const commandes = await this.prisma.shopOrder.findMany({
      where: {
        shopId,
        status: { in: STATUTS_ACHAT_VERIFIE },
        order: { buyerId: authorId },
        reviews: { none: {} },
      },
      select: { id: true, createdAt: true, lines: { include: { variant: { include: { product: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    return commandes.map((c) => ({
      id: c.id,
      date: c.createdAt,
      articles: c.lines.map((l) => l.variant.product.name),
    }));
  }
}
