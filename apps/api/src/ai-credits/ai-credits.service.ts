import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "../finance/accounting.service";
import { CreateAiServiceDto, UpdateAiServiceDto } from "./dto/ai-service.dto";

/**
 * Services à la carte — crédits IA (14 oct. 2026, plan commercial). Une
 * boutique demande `quantity` crédits ; le montant facturé est calculé une
 * fois, au prix unitaire en vigueur au moment de la demande
 * (`PlatformSettings.aiCreditUnitPrice`), jamais recalculé ensuite — même
 * principe que la commission ELEGANZ Market et le taux de change. Les
 * crédits ne sont ajoutés au portefeuille qu'une fois la facture
 * correspondante marquée payée par un administrateur (même cycle manuel que
 * le reste de la facturation du projet : pas de crédit avant paiement
 * confirmé, pas de planificateur automatique).
 */
@Injectable()
export class AiCreditsService {
  private readonly logger = new Logger(AiCreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  private async getOrCreateWallet(shopId: string) {
    const existant = await this.prisma.aiCreditWallet.findUnique({ where: { shopId } });
    if (existant) return existant;
    return this.prisma.aiCreditWallet.create({ data: { shopId } });
  }

  async getWallet(shopId: string) {
    const wallet = await this.getOrCreateWallet(shopId);
    const transactions = await this.prisma.aiCreditTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { balance: wallet.balance, transactions };
  }

  /**
   * Catalogue public des services IA consommant des crédits — seulement les
   * actifs, et seulement leur coût, jamais de donnée interne (fournisseur).
   */
  async listActiveServices() {
    return this.prisma.aiService.findMany({
      where: { active: true },
      select: { id: true, name: true, description: true, creditCost: true },
      orderBy: { creditCost: "asc" },
    });
  }

  adminListServices() {
    return this.prisma.aiService.findMany({ orderBy: { name: "asc" } });
  }

  adminCreateService(dto: CreateAiServiceDto) {
    return this.prisma.aiService.create({ data: dto });
  }

  adminUpdateService(id: string, dto: UpdateAiServiceDto) {
    return this.prisma.aiService.update({ where: { id }, data: dto });
  }

  /**
   * Demande d'achat de crédits par la boutique. Échoue explicitement tant
   * que l'admin n'a fixé aucun prix unitaire (`aiCreditUnitPrice`) — jamais
   * de prix inventé par défaut.
   */
  async requestTopUp(shopId: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new BadRequestException("La quantité de crédits doit être un nombre entier positif.");
    }
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: "platform" } });
    const prixUnitaire = settings?.aiCreditUnitPrice;
    if (prixUnitaire === null || prixUnitaire === undefined) {
      throw new ConflictException(
        "L'achat de crédits IA n'est pas encore disponible : aucun prix n'a été configuré par l'administration.",
      );
    }
    const wallet = await this.getOrCreateWallet(shopId);
    const montant = Math.round(quantity * Number(prixUnitaire) * 100) / 100;
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.create({
        data: {
          shopId,
          amount: montant,
          dueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          kind: "ai_credits",
        },
      });
      return tx.aiCreditTopUp.create({
        data: { walletId: wallet.id, quantity, invoiceId: invoice.id },
        include: { invoice: true },
      });
    });
  }

  /**
   * Vue admin des demandes d'achat de crédits non encore payées — nécessaire
   * pour savoir lesquelles valider (voir markTopUpPaidAndGrant ci-dessous).
   */
  listPendingTopUps() {
    return this.prisma.aiCreditTopUp.findMany({
      where: { invoice: { status: "PENDING" } },
      include: {
        invoice: true,
        wallet: { select: { shopId: true, shop: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Marque la facture payée et accorde les crédits au portefeuille, dans la
   * même transaction — jamais l'un sans l'autre. Contrairement à
   * BillingService.markInvoicePaidAndReactivate, ne touche jamais au statut
   * de la boutique : un achat de crédits IA est indépendant de l'abonnement
   * Gestion et de sa suspension éventuelle.
   */
  async markTopUpPaidAndGrant(invoiceId: string) {
    const topUp = await this.prisma.aiCreditTopUp.findUnique({
      where: { invoiceId },
      include: { invoice: true },
    });
    if (!topUp) {
      throw new NotFoundException("Aucune demande d'achat de crédits IA ne correspond à cette facture.");
    }
    if (topUp.invoice.status === "PAID") {
      throw new ConflictException("Cette facture a déjà été marquée payée.");
    }

    const [invoice] = await this.prisma.$transaction([
      this.prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: new Date() } }),
      this.prisma.aiCreditWallet.update({
        where: { id: topUp.walletId },
        data: { balance: { increment: topUp.quantity } },
      }),
      this.prisma.aiCreditTransaction.create({
        data: { walletId: topUp.walletId, delta: topUp.quantity, service: "top_up" },
      }),
    ]);

    // Revenu ELEGANZ reconnu au règlement effectif, jamais à la facturation
    // (même principe que les autres factures — docs/ARCHITECTURE_FINANCE.md §8bis.3).
    await this.accounting.postPlatformInvoicePaid(invoice, "invoice").catch((err) => {
      // Ne bloque jamais l'octroi des crédits déjà accordé ci-dessus si la
      // comptabilisation échoue — même choix que BillingService.
      this.logger.error(`Comptabilisation de la facture ${invoiceId} (crédits IA) échouée`, err);
    });

    return { invoice, balanceGranted: topUp.quantity };
  }
}
