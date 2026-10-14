import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { CreateReceptionStockDto } from "./dto/reception-stock.dto";
import { StockMovementType } from "@eleganz/database";

/**
 * Stock & CMV — chantier SYSCOHADA, phase 4 (14 oct. 2026). Coût Unitaire
 * Moyen Pondéré (CUMP) retenu plutôt que FIFO : pas d'historique de lots à
 * tenir, c'est la méthode la plus simple à maintenir de façon fiable avec
 * le modèle de données actuel, et la plus répandue en pratique SYSCOHADA
 * régionale. Voir Doc "Finance & Comptabilité SYSCOHADA — Audit & plan
 * d'intégration", tabs D/E.
 *
 * Ce service ne couvre à cette phase que les ENTRÉES (réceptions) — la
 * valorisation des SORTIES (vente) au CUMP, avec écriture 603/311, reste à
 * câbler dans un commit séparé (touche pos.service.ts déjà en production).
 */
@Injectable()
export class StockValorisationService {
  private readonly logger = new Logger(StockValorisationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  private async getVariantOwned(shopId: string, variantId: string) {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { product: { select: { shopId: true } } },
    });
    if (!variant) throw new NotFoundException("Variante introuvable.");
    if (variant.product.shopId !== shopId) throw new ForbiddenException("Cette variante n'appartient pas à cette boutique.");
    return variant;
  }

  async receptionner(shopId: string, dto: CreateReceptionStockDto) {
    const variant = await this.getVariantOwned(shopId, dto.variantId);
    const montant = Math.round(dto.quantity * dto.coutUnitaire * 100) / 100;

    // CUMP = (ancienne valeur de stock + valeur entrante) / (ancienne qté +
    // qté entrante). `coutMoyenPondere` reste `null` tant qu'aucune
    // réception n'a eu lieu : jamais une valeur inventée pour un stock déjà
    // en cours avant ce chantier.
    const ancienneQte = variant.stockQty;
    const ancienCump = variant.coutMoyenPondere ? Number(variant.coutMoyenPondere) : 0;
    const ancienneValeur = ancienneQte * ancienCump;
    const nouvelleQte = ancienneQte + dto.quantity;
    const nouveauCump = nouvelleQte > 0 ? (ancienneValeur + montant) / nouvelleQte : dto.coutUnitaire;

    const reception = await this.prisma.$transaction(async (tx) => {
      const reception = await tx.receptionStock.create({
        data: {
          shopId,
          variantId: dto.variantId,
          quantity: dto.quantity,
          coutUnitaire: dto.coutUnitaire,
          supplierId: dto.supplierId,
          onCredit: !!dto.onCredit,
        },
      });

      await tx.variant.update({
        where: { id: dto.variantId },
        data: {
          stockQty: { increment: dto.quantity },
          coutMoyenPondere: Math.round(nouveauCump * 10000) / 10000,
        },
      });

      await tx.stockMovement.create({
        data: {
          shopId,
          variantId: dto.variantId,
          type: StockMovementType.PURCHASE_IN,
          quantity: dto.quantity,
          coutUnitaire: dto.coutUnitaire,
          valeur: montant,
          reference: `reception:${reception.id}`,
        },
      });

      if (dto.supplierId && dto.onCredit) {
        await tx.supplier.update({
          where: { id: dto.supplierId },
          data: { balanceOwed: { increment: montant } },
        });
      }

      return reception;
    });

    await this.accounting
      .postReceptionStock({ id: reception.id, shopId, montant, onCredit: !!dto.onCredit })
      .catch((err) => {
        this.logger.error(`Comptabilisation de la réception ${reception.id} échouée`, err);
      });

    return { ...reception, nouveauCump: Math.round(nouveauCump * 10000) / 10000, nouvelleQte };
  }

  async listPourVariante(shopId: string, variantId: string) {
    await this.getVariantOwned(shopId, variantId);
    return this.prisma.receptionStock.findMany({
      where: { shopId, variantId },
      orderBy: { createdAt: "desc" },
    });
  }
}
