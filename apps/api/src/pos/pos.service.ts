import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
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
    let cmvTotal = 0;
    const sale = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const discrepancyByLineIndex = new Set<number>();

      for (const [index, line] of dto.lines.entries()) {
        total += line.quantity * line.unitPrice;

        if (line.variantId) {
          const variant = await tx.variant.findUniqueOrThrow({ where: { id: line.variantId } });

          // Mise à jour conditionnelle atomique (20 oct. 2026, audit de
          // lancement) : vérifier `stockQty` puis le décrémenter en deux
          // requêtes séparées laissait une fenêtre où deux ventes
          // concurrentes sur le dernier exemplaire (caisse + caisse, ou
          // caisse + Marketplace) pouvaient toutes deux passer la
          // vérification avant que l'une ne décrémente — une vraie
          // survente. `updateMany` avec `stockQty: { gte }` dans le WHERE
          // rend la vérification et la décrémentation indissociables au
          // niveau de la base de données elle-même.
          if (!options.allowNegativeStock) {
            const resultat = await tx.variant.updateMany({
              where: { id: line.variantId, stockQty: { gte: line.quantity } },
              data: { stockQty: { decrement: line.quantity } },
            });
            if (resultat.count === 0) {
              throw new BadRequestException(
                `Stock insuffisant pour ${variant.sku} : ${variant.stockQty} disponible(s), ${line.quantity} demandé(s).`,
              );
            }
          } else {
            // Synchronisation hors-ligne : la vente a déjà réellement eu
            // lieu pendant la coupure, jamais annulée — on accepte un stock
            // négatif et on signale l'écart au lieu de rejeter.
            if (variant.stockQty < line.quantity) {
              discrepancyByLineIndex.add(index);
            }
            await tx.variant.update({
              where: { id: line.variantId },
              data: { stockQty: { decrement: line.quantity } },
            });
          }

          // Valorisation CUMP de la sortie (chantier SYSCOHADA phase 4b, 14
          // oct. 2026) — `coutUnitaire`/`valeur` restent `null` tant que la
          // variante n'a jamais reçu de réception valorisée (voir
          // StockValorisationService) : jamais un coût inventé. `cmvTotal`
          // n'accumule que les lignes dont le coût est réellement connu.
          const cumpConnu = variant.coutMoyenPondere != null;
          const valeurSortie = cumpConnu ? Math.round(line.quantity * Number(variant.coutMoyenPondere) * 100) / 100 : null;
          if (valeurSortie !== null) cmvTotal += valeurSortie;

          await tx.stockMovement.create({
            data: {
              shopId,
              variantId: line.variantId,
              type: StockMovementType.POS_SALE_OUT,
              quantity: -line.quantity,
              coutUnitaire: cumpConnu ? variant.coutMoyenPondere : undefined,
              valeur: valeurSortie !== null ? -valeurSortie : undefined,
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
    // réellement été encaissé : elle est journalisée, pas propagée. Le
    // marqueur ACCOUNTING_POSTING_FAILED permet de grepper ces échecs dans
    // les logs — par exemple une période clôturée par erreur (voir
    // docs/ARCHITECTURE_FINANCE.md §8quinquies), mais aussi toute autre
    // cause. Rappel distinct, confirmé le 16 oct. 2026 sur ELEGANZ STORE :
    // une vente antérieure à la mise en service de ce câblage comptable
    // (avant le commit qui l'a introduit) n'a et n'aura jamais d'écriture —
    // ce n'est ni une erreur ni un cas que ce marqueur peut détecter, car
    // aucune tentative de comptabilisation n'a jamais eu lieu pour elle.
    await this.accounting.postPosSale(sale).catch((err) => {
      this.logger.error(this.describePostingFailure("vente", sale.id, shopId, err), err);
    });

    // Écriture CMV séparée (chantier SYSCOHADA phase 4b) — seulement si au
    // moins une ligne avait un CUMP connu ; une erreur ici ne doit jamais
    // non plus annuler la vente déjà encaissée (même garde que ci-dessus).
    if (cmvTotal > 0) {
      await this.accounting.postSortieStockVente(sale, cmvTotal).catch((err) => {
        this.logger.error(this.describePostingFailure("CMV", sale.id, shopId, err), err);
      });
    }

    return sale;
  }

  /**
   * Message de log greppable (marqueur `ACCOUNTING_POSTING_FAILED`) pour un
   * échec de comptabilisation volontairement avalé ci-dessus. Distingue le
   * cas d'une période clôturée (`ConflictException` levée par
   * `AccountingService.enregistrer` — voir accounting.service.ts) de toute
   * autre erreur, pour que ce cas précis soit repérable sans avoir à lire la
   * stack trace complète. Ce marqueur ne couvre que les tentatives de
   * comptabilisation qui ont réellement eu lieu et échoué : une vente
   * enregistrée avant la mise en service de ce câblage (voir l'historique
   * Git de ce fichier) n'a jamais déclenché d'appel ici, donc rien à
   * grepper pour elle — vérifié le 16 oct. 2026 sur ELEGANZ STORE, où le
   * Rapport annuel 2026 à $0 s'est avéré dû à des ventes du 12 oct. 2026,
   * antérieures de plus d'une journée au premier commit câblant
   * `postPosSale` (cc06305, 13 oct. 2026 22h10), et non à une période
   * clôturée.
   */
  private describePostingFailure(nature: string, saleId: string, shopId: string, err: unknown): string {
    if (err instanceof ConflictException) {
      return (
        `ACCOUNTING_POSTING_FAILED période clôturée : comptabilisation du ${nature} de la vente ${saleId} ` +
        `(boutique ${shopId}) refusée — vérifier /finance/cloture pour cette boutique et rouvrir la période si ` +
        `elle a été clôturée par erreur, puis rejouer cette écriture.`
      );
    }
    return `ACCOUNTING_POSTING_FAILED comptabilisation du ${nature} de la vente ${saleId} (boutique ${shopId}) échouée`;
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

  /**
   * Annulation d'une vente caisse. Corrigé le 20 oct. 2026 (audit de
   * lancement) : la version précédente ne recevait pas `shopId` et ne
   * vérifiait jamais que la vente appartenait bien à la boutique de
   * l'appelant — n'importe quel membre authentifié d'une boutique pouvait
   * annuler la vente d'une AUTRE boutique en devinant son identifiant.
   * Scopée désormais comme toutes les autres opérations (`findFirstOrThrow`
   * sur `shopId`), et protégée côté contrôleur par `@ShopRoles`. Ajout aussi
   * d'une garde d'idempotence : annuler deux fois la même vente aurait
   * sinon restitué le stock deux fois.
   */
  async cancelSale(shopId: string, saleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.findFirstOrThrow({
        where: { id: saleId, shopId },
        include: { lines: true },
      });

      if (sale.status === "CANCELLED") {
        return sale;
      }

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
   * Distingue explicitement CA, encaissements confirmés et bénéfice.
   *
   * Marge brute harmonisée avec le CUMP réellement comptabilisé (14 oct.
   * 2026, chantier SYSCOHADA) — voir finance.service.ts::dashboardForShop
   * pour le même changement et son motif : le CMV vient des
   * StockMovement(POS_SALE_OUT) déjà valorisés au CUMP lors de la vente,
   * plus fiable que l'ancien Variant.costPrice (champ manuel, jamais
   * synchronisé avec les réceptions de stock).
   */
  async dailyDashboard(shopId: string, date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [sales, cmvAgg, cmvInconnuCount] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { shopId, createdAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } },
        include: { lines: true, payments: true },
      }),
      this.prisma.stockMovement.aggregate({
        where: { shopId, type: StockMovementType.POS_SALE_OUT, createdAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { valeur: true },
      }),
      this.prisma.stockMovement.count({
        where: {
          shopId,
          type: StockMovementType.POS_SALE_OUT,
          createdAt: { gte: startOfDay, lt: endOfDay },
          valeur: null,
        },
      }),
    ]);

    const revenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const confirmedCollections = sales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0),
      0,
    );

    const venteSansVariante = sales.some((s) => s.lines.some((l) => !l.variantId));
    const costKnownForAllLines = cmvInconnuCount === 0 && !venteSansVariante;
    const cmvDuJour = -(Number(cmvAgg._sum.valeur ?? 0));
    const grossMargin = revenue - cmvDuJour;

    return {
      date: startOfDay.toISOString().slice(0, 10),
      salesCount: sales.length,
      revenue, // chiffre d'affaires — ne pas confondre avec le bénéfice
      confirmedCollections, // encaissements réellement confirmés
      grossMargin: costKnownForAllLines ? grossMargin : null,
      marginReliable: costKnownForAllLines,
      note: costKnownForAllLines
        ? undefined
        : "Marge non calculable de façon fiable : coût moyen pondéré (CUMP) inconnu pour au moins un article vendu, ou vente rapide sans article catalogué.",
    };
  }
}
