import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { FiscalRuleScope } from "@eleganz/database";

/**
 * Lecture du journal général, du grand livre et de la balance — à partir des
 * écritures réellement générées par AccountingService. Voir
 * docs/ARCHITECTURE_FINANCE.md §8bis.5. Aucune de ces trois lectures n'est un
 * état financier réglementaire (bilan/compte de résultat/TFT) : ce sont des
 * vues brutes des écritures, pas des regroupements par classe de compte.
 */
@Injectable()
export class AccountingQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async journal(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date, journalCode?: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        scope,
        shopId,
        entryDate: { gte: from, lt: to },
        ...(journalCode ? { journal: { code: journalCode } } : {}),
      },
      include: { journal: true, lines: { include: { account: true } } },
      orderBy: { entryDate: "asc" },
    });
  }

  async grandLivre(scope: FiscalRuleScope, shopId: string | null, accountCode: string, from: Date, to: Date) {
    const lignes = await this.prisma.journalLine.findMany({
      where: {
        account: { scope, shopId, code: accountCode },
        entry: { entryDate: { gte: from, lt: to } },
      },
      include: { entry: true, account: true },
      orderBy: { entry: { entryDate: "asc" } },
    });

    let solde = 0;
    const mouvements = lignes.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      solde += debit - credit;
      return {
        date: l.entry.entryDate,
        label: l.label ?? l.entry.label,
        sourceType: l.entry.sourceType,
        debit,
        credit,
        soldeCumule: solde,
      };
    });

    return { compte: accountCode, mouvements, soldeFinal: solde };
  }

  async balance(scope: FiscalRuleScope, shopId: string | null, from: Date, to: Date) {
    const comptes = await this.prisma.account.findMany({ where: { scope, shopId, active: true } });
    const entrees = comptes.length
      ? await this.prisma.journalEntry.findMany({
          where: { scope, shopId, entryDate: { gte: from, lt: to } },
          select: { id: true },
        })
      : [];
    const entryIds = entrees.map((e) => e.id);
    const lignes = entryIds.length
      ? await this.prisma.journalLine.groupBy({
          by: ["accountId"],
          where: { entryId: { in: entryIds } },
          _sum: { debit: true, credit: true },
        })
      : [];

    const parCompte = new Map(lignes.map((l) => [l.accountId, l]));
    let totalDebit = 0;
    let totalCredit = 0;
    const comptesAvecMouvement = comptes
      .map((compte) => {
        const agg = parCompte.get(compte.id);
        const debit = Number(agg?._sum.debit ?? 0);
        const credit = Number(agg?._sum.credit ?? 0);
        totalDebit += debit;
        totalCredit += credit;
        return {
          code: compte.code,
          label: compte.label,
          debit,
          credit,
          solde: compte.normalSide === "DEBIT" ? debit - credit : credit - debit,
        };
      })
      .filter((c) => c.debit !== 0 || c.credit !== 0);

    return {
      periode: { from: from.toISOString(), to: to.toISOString() },
      comptes: comptesAvecMouvement,
      totalDebit,
      totalCredit,
      // Vrai pour toute balance correctement tenue en partie double : si ce
      // n'est pas le cas ici, c'est un signal d'anomalie à afficher, jamais
      // à masquer (voir docs/ARCHITECTURE_FINANCE.md §8bis.5).
      equilibree: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }
}
