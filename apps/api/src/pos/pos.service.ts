import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { PaymentMethod, StockMovementType } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  /**
   * Vente de caisse transactionnelle : décompte du stock et enregistrement de
   * la vente se font dans la même transaction DB, pour empêcher la double
   * vente décrite dans le complément stratégique (§5) — une commande en ligne
   * concurrente sur le même article ne peut pas vendre un stock déjà écoulé
   * en caisse, et inversement.
   *
   * `allowNegativeStock` sert exclusivement à la synchronisation hors-ligne
   * (voir `syncOfflineSale` ci-dessous et docs/ARCHITECTURE_HORS_LIGNE.md) :
   * une vente en direct reste bloquée par un stock insuffisant (la caissière
   * peut regarder l'étagère), mais une vente synchronisée après coup
   * correspond à de l'argent déjà réellement encaissé pendant une coupure —
   * on ne l'efface jamais, on signale l'écart (`stockDiscrepancy`) pour que
   * la boutique régularise elle-même. Décision validée par le propriétaire.
   */
  async createSale(
    shopId: string,
    dto: CreateSaleDto & { cashierId: string; clientOperationId?: string },
    options: { allowNegativeStock?: boolean } = {},
  ) {
    const sale = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const discrepancyByLineIndex = new Set<number>();

      for (const [index, line] of dto.lines.entries()) {
        total += line.quantity * line.unitPrice;

        if (line.variantId) {
          const variant = await tx.variant.findUniqueOrThrow({ where: { id: line.variantId } });
          if (variant.stockQty < line.quantity) {
            if (!options.allowNegativeStock) {
              throw new BadRequestException(
                `Stock insuffisant pour ${variant.sku} : ${variant.stockQty} disponible(s), ${line.quantity} demandé(s).`,
              );
            }
            discrepancyByLineIndex.add(index);
          }

          await tx.variant.update({
            where: { id: line.variantId },
            data: { stockQty: { decrement: line.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              shopId,
              variantId: line.variantId,
              type: StockMovementType.POS_SALE_OUT,
              quantity: -line.quantity,
            },
          });
        }
        // Une ligne sans variantId est une vente rapide d'article non catalogué :
        // elle entre dans le chiffre d'affaires mais ne touche aucun stock
        // (complément stratégique §3 — ne jamais modifier arbitrairement d'autres articles).
      }

      const paidAmount = dto.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paidAmount - total) > 0.01) {
        throw new BadRequestException(
          `Le total encaissé (${paidAmount}) ne correspond pas au total de la vente (${total}).`,
        );
      }

      const creditAmount = dto.payments
        .filter((p) => p.method === PaymentMethod.STORE_CREDIT)
        .reduce((sum, p) => sum + p.amount, 0);
      if (creditAmount > 0 && !dto.customerId) {
        throw new BadRequestException("Un client est requis pour une vente à crédit.");
      }

      const sale = await tx.posSale.create({
        data: {
          shopId,
          cashierId: dto.cashierId,
          customerId: dto.customerId,
          totalAmount: total,
          currency: dto.currency ?? "USD",
          clientOperationId: dto.clientOperationId,
          lines: {
            create: dto.lines.map((l, index) => ({
              variantId: l.variantId,
              label: l.label,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              stockDiscrepancy: discrepancyByLineIndex.has(index),
            })),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              confirmed: p.confirmed ?? true,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      // Vente à crédit : la part STORE_CREDIT augmente la créance du client
      // (complément stratégique §9), toujours dans la même transaction pour
      // qu'une vente et sa créance ne puissent jamais être incohérentes.
      if (creditAmount > 0 && dto.customerId) {
        await tx.shopCustomer.update({
          where: { id: dto.customerId },
          data: { creditBalance: { increment: creditAmount } },
        });
      }

      return sale;
    });

    // Comptabilisation après la transaction métier (jamais avant, jamais en
    // la réécrivant) — voir docs/ARCHITECTURE_FINANCE.md §8bis. Une erreur
    // de comptabilisation ne doit jamais annuler une vente dont l'argent a
    // réellement été encaissé : elle est journalisée, pas propagée.
    await this.accounting.postPosSale(sale).catch((err) => {
      this.logger.error(`Comptabilisation de la vente ${sale.id} échouée`, err);
    });

    return sale;
  }

  /**
   * Point d'entrée de synchronisation hors-ligne
   * (docs/ARCHITECTURE_HORS_LIGNE.md, phase 1). Idempotent sur
   * `clientOperationId`, généré côté client avant tout appel réseau : si la
   * même opération est envoyée deux fois (coupure pendant la réponse,
   * nouvelle tentative de l'appareil), on renvoie la vente déjà enregistrée
   * au lieu d'en créer une seconde et de décompter le stock deux fois.
   */
  async syncOfflineSale(
    shopId: string,
    dto: CreateSaleDto & { cashierId: string; clientOperationId: string },
  ) {
    const existante = await this.prisma.posSale.findUnique({
      where: { clientOperationId: dto.clientOperationId },
      include: { lines: true, payments: true },
    });
    if (existante) {
      return existante;
    }
    return this.createSale(shopId, dto, { allowNegativeStock: true });
  }

  /**
   * Lignes de vente dont le stock est descendu sous zéro pendant une
   * synchronisation différée — à régulariser manuellement par la boutique
   * (comptage, remboursement, réapprovisionnement). Jamais corrigé seul par
   * le système : c'est une décision commerciale, pas technique.
   */
  async listStockDiscrepancies(shopId: string) {
    return this.prisma.posSaleLine.findMany({
      where: { stockDiscrepancy: true, sale: { shopId } },
      include: { sale: { select: { id: true, createdAt: true, cashierId: true } }, variant: true },
      orderBy: { sale: { createdAt: "desc" } },
    });
  }

  async cancelSale(saleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.findUniqueOrThrow({
        where: { id: saleId },
        include: { lines: true },
      });

      for (const line of sale.lines) {
        if (line.variantId) {
          await tx.variant.update({
            where: { id: line.variantId },
            data: { stockQty: { increment: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              shopId: sale.shopId,
              variantId: line.variantId,
              type: StockMovementType.RETURN_IN,
              quantity: line.quantity,
              reference: sale.id,
            },
          });
        }
      }

      return tx.posSale.update({ where: { id: saleId }, data: { status: "CANCELLED" } });
    });
  }

  /**
   * Tableau de bord chiffre d'affaires journalier (complément stratégique §4).
   * Distingue explicitement CA, encaissements confirmés et bénéfice — qui
   * n'est calculable que si costPrice est renseigné sur les lignes vendues.
   */
  async dailyDashboard(shopId: string, date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const sales = await this.prisma.posSale.findMany({
      where: { shopId, createdAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } },
      include: { lines: { include: { variant: true } }, payments: true },
    });

    const revenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const confirmedCollections = sales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0),
      0,
    );

    let costKnownForAllLines = true;
    let grossMargin = 0;
    for (const sale of sales) {
      for (const line of sale.lines) {
        const cost = line.variant?.costPrice;
        if (cost == null) {
          costKnownForAllLines = false;
          continue;
        }
        grossMargin += (Number(line.unitPrice) - Number(cost)) * line.quantity;
      }
    }

    return {
      date: startOfDay.toISOString().slice(0, 10),
      salesCount: sales.length,
      revenue, // chiffre d'affaires — ne pas confondre avec le bénéfice
      confirmedCollections, // encaissements réellement confirmés
      grossMargin: costKnownForAllLines ? grossMargin : null,
      marginReliable: costKnownForAllLines,
      note: costKnownForAllLines
        ? undefined
        : "Marge non calculable de façon fiable : prix d'achat manquant sur au moins un article vendu.",
    };
  }
}
