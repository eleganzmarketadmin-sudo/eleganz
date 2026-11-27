import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { CreateReceptionStockDto } from "./dto/reception-stock.dto";
import { StockMovementType } from "@eleganz/database";
import { construireClasseurExcel } from "../common/xlsx.util";

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
    // qté entrante) — MAIS seulement quand l'ancien CUMP est déjà connu.
    // Quand `coutMoyenPondere` est `null` (aucune réception valorisée
    // encore pour cette variante), la quantité déjà en stock n'a tout
    // simplement pas de coût connu : la traiter comme un coût de 0 (comme
    // le ferait la formule ci-dessous sans cette garde) diluerait le CUMP
    // vers le bas de façon fausse, pas "prudente". Le choix assumé ici est
    // d'adopter le coût de CETTE réception comme CUMP de départ pour toute
    // la quantité désormais en stock — pas une moyenne avec un coût inventé
    // à 0, et pas non plus un blocage qui empêcherait de valoriser un stock
    // préexistant (14 oct. 2026, chantier SYSCOHADA phase 4).
    const ancienneQte = variant.stockQty;
    const nouvelleQte = ancienneQte + dto.quantity;
    const nouveauCump =
      variant.coutMoyenPondere != null
        ? (ancienneQte * Number(variant.coutMoyenPondere) + montant) / nouvelleQte
        : dto.coutUnitaire;

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
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la réception ${reception.id} échouée`, err);
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

  /**
   * Lignes d'export Stock & CMV (27 nov. 2026, demande : "possibilité
   * d'exporter en Excel ou pdf"), gardé distinct de `listPourVariante`
   * ci-dessus — une ligne par variante, toutes les variantes de la
   * boutique, valeur de stock calculée au CUMP connu (0 si CUMP encore
   * inconnu, cohérent avec l'affichage "—" déjà en place sur l'écran).
   */
  async listPourExport(shopId: string) {
    const variants = await this.prisma.variant.findMany({
      where: { product: { shopId } },
      include: { product: { select: { name: true } } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    });
    return variants.map((v) => {
      const cump = v.coutMoyenPondere != null ? Number(v.coutMoyenPondere) : null;
      return {
        produitNom: v.product.name,
        sku: v.sku,
        size: v.size,
        color: v.color,
        stockQty: v.stockQty,
        cump,
        valeurStock: cump != null ? Math.round(v.stockQty * cump * 100) / 100 : 0,
        lowStockAt: v.lowStockAt,
      };
    });
  }

  async exporterExcel(shopId: string): Promise<Buffer> {
    const lignes = await this.listPourExport(shopId);
    const entetes = ["Article", "Variante", "Stock", "CUMP", "Valeur stock", "Seuil alerte"];
    const corps = lignes.map((l) => [
      l.produitNom,
      [l.sku, l.size, l.color].filter(Boolean).join(" · "),
      l.stockQty,
      l.cump ?? "",
      l.valeurStock,
      l.lowStockAt,
    ]);
    return construireClasseurExcel("Stock", entetes, corps);
  }
}
