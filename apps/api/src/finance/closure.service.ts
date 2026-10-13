import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingQueryService } from "./accounting-query.service";
import { FiscalRuleScope } from "@eleganz/database";

function debutDuMois(periode: string): Date {
  // periode au format "AAAA-MM"
  const [annee, mois] = periode.split("-").map(Number);
  return new Date(Date.UTC(annee, mois - 1, 1));
}

/**
 * Assistant de clôture de période (docs/ARCHITECTURE_FINANCE.md
 * §8quinquies) — verrouille un mois (plus aucune écriture acceptée pour ce
 * mois, voir AccountingService.enregistrer) et fige un résumé (totaux
 * débit/crédit, résultat net) au moment de la clôture. La réouverture
 * (suppression de la clôture) reste possible : cet outil n'est pas un
 * registre légalement immuable, seulement une aide interne — fermer cette
 * possibilité aurait transformé une simple erreur de manipulation en
 * blocage définitif, ce qui n'est pas souhaitable pour un outil encore à ce
 * stade de maturité.
 */
@Injectable()
export class ClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingQuery: AccountingQueryService,
  ) {}

  list(scope: FiscalRuleScope, shopId: string | null) {
    return this.prisma.accountingClosure.findMany({
      where: { scope, shopId },
      orderBy: { periodDate: "desc" },
    });
  }

  async close(scope: FiscalRuleScope, shopId: string | null, periode: string, closedBy: string | null) {
    const debut = debutDuMois(periode);
    const fin = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 1));

    const existante = await this.prisma.accountingClosure.findFirst({
      where: { scope, shopId, periodDate: debut },
      select: { id: true },
    });
    if (existante) {
      throw new ConflictException(`La période ${periode} est déjà clôturée.`);
    }

    const [balance, compteResultat] = await Promise.all([
      this.accountingQuery.balance(scope, shopId, debut, fin),
      this.accountingQuery.compteDeResultat(scope, shopId, debut, fin),
    ]);

    return this.prisma.accountingClosure.create({
      data: {
        scope,
        shopId,
        periodDate: debut,
        closedBy,
        totalDebit: balance.totalDebit,
        totalCredit: balance.totalCredit,
        resultatNet: compteResultat.resultatNet,
      },
    });
  }

  async reopen(scope: FiscalRuleScope, shopId: string | null, periode: string) {
    const debut = debutDuMois(periode);
    const existante = await this.prisma.accountingClosure.findFirst({ where: { scope, shopId, periodDate: debut } });
    if (!existante) {
      throw new NotFoundException(`La période ${periode} n'est pas clôturée.`);
    }
    await this.prisma.accountingClosure.delete({ where: { id: existante.id } });
  }
}
