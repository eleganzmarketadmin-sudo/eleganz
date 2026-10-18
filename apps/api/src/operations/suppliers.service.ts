import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierDto, RecordPurchaseDto, SettleDebtDto } from "./dto/supplier.dto";
import { AccountingService } from "../finance/accounting.service";

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  create(shopId: string, dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: { shopId, name: dto.name, phone: dto.phone } });
  }

  list(shopId: string) {
    return this.prisma.supplier.findMany({ where: { shopId }, include: { purchases: true } });
  }

  async recordPurchase(supplierId: string, dto: RecordPurchaseDto) {
    const purchase = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          amount: dto.amount,
          // Conservé sur l'achat lui-même depuis le 13 oct. 2026 (moteur
          // comptable) — voir docs/ARCHITECTURE_FINANCE.md §8bis.4.
          onCredit: !!dto.onCredit,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        },
      });

      if (dto.onCredit) {
        await tx.supplier.update({
          where: { id: supplierId },
          data: { balanceOwed: { increment: dto.amount } },
        });
      }

      return purchase;
    });

    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    await this.accounting.postPurchase(purchase, supplier.shopId).catch((err) => {
      this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de l'achat ${purchase.id} échouée`, err);
    });

    return purchase;
  }

  /**
   * `dto.purchaseId` optionnel (14 oct. 2026, créances & dettes) : quand
   * fourni, enregistre un `ReglementFournisseur` lié à cet achat précis
   * (lettrage par saisie explicite) en plus de la décrémentation du solde
   * cumulé — qui reste la seule source de vérité pour le solde affiché,
   * comme avant ce chantier.
   *
   * Correctifs audit du 16 oct. 2026 :
   *  1. Un règlement ne peut plus dépasser le solde dû (plus de
   *     balanceOwed négatif silencieux faute de validation).
   *  2. Le règlement pose désormais une écriture comptable réelle (401 /
   *     caisse, voir AccountingService.postSupplierPayment) — jusqu'ici
   *     le solde baissait sans que la dette ni la sortie de caisse soient
   *     jamais constatées en comptabilité.
   */
  async settleDebt(supplierId: string, dto: SettleDebtDto) {
    const supplier = await this.prisma.supplier.findUniqueOrThrow({ where: { id: supplierId } });
    if (dto.amount > Number(supplier.balanceOwed)) {
      throw new BadRequestException(
        `Le règlement (${dto.amount}) dépasse le solde dû (${supplier.balanceOwed}) pour ce fournisseur.`,
      );
    }

    if (dto.purchaseId) {
      await this.prisma.reglementFournisseur.create({
        data: {
          purchaseId: dto.purchaseId,
          amount: dto.amount,
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          method: dto.method,
        },
      });
    }
    const resultat = await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { balanceOwed: { decrement: dto.amount } },
    });

    await this.accounting
      .postSupplierPayment({ sourceId: dto.purchaseId ?? crypto.randomUUID(), shopId: supplier.shopId, amount: dto.amount })
      .catch((err) => {
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation du règlement fournisseur ${supplierId} échouée`, err);
      });

    return resultat;
  }

  /**
   * Échéancier fournisseurs (14 oct. 2026) — achats à crédit avec une
   * échéance saisie, triés par date d'échéance. `restant` = montant de
   * l'achat moins la somme des règlements déjà lettrés sur cet achat ;
   * reste positif tant que l'utilisateur n'a pas réglé via `purchaseId`
   * (voir `settleDebt`) — un règlement global sans `purchaseId` ne réduit
   * donc pas ce chiffre, pour ne pas prétendre un lettrage qui n'a pas eu
   * lieu.
   */
  async echeancier(shopId: string) {
    const achats = await this.prisma.purchase.findMany({
      where: { supplier: { shopId }, onCredit: true, dueDate: { not: null } },
      include: { supplier: true, reglements: true },
      orderBy: { dueDate: "asc" },
    });
    return achats.map((a) => {
      const regle = a.reglements.reduce((s, r) => s + Number(r.amount), 0);
      return {
        purchaseId: a.id,
        fournisseur: a.supplier.name,
        montant: Number(a.amount),
        dueDate: a.dueDate,
        regle,
        restant: Math.round((Number(a.amount) - regle) * 100) / 100,
        enRetard: a.dueDate ? a.dueDate < new Date() : false,
      };
    });
  }
}
