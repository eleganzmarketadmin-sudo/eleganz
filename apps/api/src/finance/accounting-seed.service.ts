import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountNormalSide, FiscalRuleScope } from "@eleganz/database";

interface SeedAccount {
  code: string;
  label: string;
  normalSide: AccountNormalSide;
}

// Plan comptable minimal (SYSCOHADA révisé) — voir
// docs/ARCHITECTURE_FINANCE.md §8bis.2. Un compte n'apparaît ici que s'il est
// réellement utilisé par une règle de comptabilisation de AccountingService ;
// pas de compte ajouté "pour faire complet".
const COMPTES_BOUTIQUE: SeedAccount[] = [
  { code: "5711", label: "Caisse USD", normalSide: AccountNormalSide.DEBIT },
  { code: "5712", label: "Caisse CDF", normalSide: AccountNormalSide.DEBIT },
  { code: "411", label: "Clients (dont créances Marketplace à recevoir de la plateforme)", normalSide: AccountNormalSide.DEBIT },
  { code: "401", label: "Fournisseurs", normalSide: AccountNormalSide.CREDIT },
  { code: "601", label: "Achats de marchandises", normalSide: AccountNormalSide.DEBIT },
  { code: "6220", label: "Charges de fonctionnement", normalSide: AccountNormalSide.DEBIT },
  { code: "6221", label: "Charges administratives", normalSide: AccountNormalSide.DEBIT },
  { code: "6222", label: "Charges commerciales", normalSide: AccountNormalSide.DEBIT },
  { code: "661", label: "Charges de personnel", normalSide: AccountNormalSide.DEBIT },
  { code: "641", label: "Impôts et taxes", normalSide: AccountNormalSide.DEBIT },
  { code: "671", label: "Charges financières", normalSide: AccountNormalSide.DEBIT },
  { code: "701", label: "Ventes de marchandises (caisse)", normalSide: AccountNormalSide.CREDIT },
  { code: "7012", label: "Ventes Marketplace", normalSide: AccountNormalSide.CREDIT },
];

const COMPTES_ELEGANZ: SeedAccount[] = [
  { code: "5711", label: "Caisse / trésorerie ELEGANZ USD", normalSide: AccountNormalSide.DEBIT },
  { code: "5712", label: "Caisse / trésorerie ELEGANZ CDF", normalSide: AccountNormalSide.DEBIT },
  { code: "411", label: "Boutiques — sommes dues à ELEGANZ", normalSide: AccountNormalSide.DEBIT },
  { code: "706", label: "Produits des abonnements et services", normalSide: AccountNormalSide.CREDIT },
];

const JOURNAUX = [
  { code: "VE", label: "Ventes" },
  { code: "AC", label: "Achats" },
  { code: "TR", label: "Trésorerie" },
  { code: "OD", label: "Opérations diverses" },
];

/**
 * Seed idempotent du plan comptable et des journaux — appelé paresseusement
 * avant la première comptabilisation d'une boutique ou d'ELEGANZ (jamais par
 * une migration de données séparée). Voir docs/ARCHITECTURE_FINANCE.md
 * §8bis.2.
 *
 * Recherche par `findFirst` + création conditionnelle plutôt que par
 * `upsert`/`findUnique` sur la clé composite `[scope, shopId, code]` :
 * `shopId` étant nullable, on évite de dépendre de la forme exacte que
 * Prisma donne à cette clé composite dans les types `WhereUniqueInput` —
 * un simple filtre par champs plats fonctionne dans tous les cas.
 */
@Injectable()
export class AccountingSeedService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureShopChartOfAccounts(shopId: string): Promise<void> {
    await this.ensure(FiscalRuleScope.SHOP, shopId, COMPTES_BOUTIQUE);
  }

  async ensurePlatformChartOfAccounts(): Promise<void> {
    await this.ensure(FiscalRuleScope.PLATFORM, null, COMPTES_ELEGANZ);
  }

  private async ensure(scope: FiscalRuleScope, shopId: string | null, comptes: SeedAccount[]) {
    for (const compte of comptes) {
      const existant = await this.prisma.account.findFirst({
        where: { scope, shopId, code: compte.code },
        select: { id: true },
      });
      if (!existant) {
        await this.prisma.account.create({
          data: { scope, shopId, code: compte.code, label: compte.label, normalSide: compte.normalSide },
        });
      }
    }
    for (const journal of JOURNAUX) {
      const existant = await this.prisma.journal.findFirst({
        where: { scope, shopId, code: journal.code },
        select: { id: true },
      });
      if (!existant) {
        await this.prisma.journal.create({
          data: { scope, shopId, code: journal.code, label: journal.label },
        });
      }
    }
  }

  async accountId(scope: FiscalRuleScope, shopId: string | null, code: string): Promise<string> {
    const compte = await this.prisma.account.findFirstOrThrow({
      where: { scope, shopId, code },
      select: { id: true },
    });
    return compte.id;
  }

  async journalId(scope: FiscalRuleScope, shopId: string | null, code: string): Promise<string> {
    const journal = await this.prisma.journal.findFirstOrThrow({
      where: { scope, shopId, code },
      select: { id: true },
    });
    return journal.id;
  }
}
