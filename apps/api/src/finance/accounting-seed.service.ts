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
  // Immobilisations et amortissements (voir docs/ARCHITECTURE_FINANCE.md
  // §8quater) — 2441 est un compte d'actif normal (DEBIT), 2841 est son
  // compte d'amortissement contra-actif (CREDIT bien que classe 2 : voir
  // le traitement spécial dans AccountingQueryService.bilan()).
  { code: "2441", label: "Matériel et mobilier de bureau", normalSide: AccountNormalSide.DEBIT },
  { code: "2841", label: "Amortissements du matériel et mobilier", normalSide: AccountNormalSide.CREDIT },
  { code: "681", label: "Dotations aux amortissements", normalSide: AccountNormalSide.DEBIT },

  // Comptes ajoutés le 14 oct. 2026 — module additionnel "Comptabilité
  // SYSCOHADA" (docs/PLAN_COMMERCIAL.md, chantier 1 réactivé, voir Doc
  // "Finance & Comptabilité SYSCOHADA — Audit & plan d'intégration", tab E).
  // Purement additif : ne remplace ni ne renumérote aucun compte existant.
  // Classe 1 — Ressources durables.
  { code: "101", label: "Capital social", normalSide: AccountNormalSide.CREDIT },
  { code: "106", label: "Réserves", normalSide: AccountNormalSide.CREDIT },
  { code: "110", label: "Report à nouveau", normalSide: AccountNormalSide.CREDIT },
  { code: "120", label: "Résultat net de l'exercice", normalSide: AccountNormalSide.CREDIT },
  { code: "162", label: "Emprunts auprès des établissements de crédit", normalSide: AccountNormalSide.CREDIT },
  { code: "191", label: "Provisions pour risques", normalSide: AccountNormalSide.CREDIT },
  // Classe 2 — complément immobilisations.
  { code: "211", label: "Immobilisations incorporelles (logiciels)", normalSide: AccountNormalSide.DEBIT },
  { code: "2181", label: "Agencements et installations", normalSide: AccountNormalSide.DEBIT },
  { code: "2811", label: "Amortissements des immobilisations incorporelles", normalSide: AccountNormalSide.CREDIT },
  { code: "2818", label: "Amortissements des agencements et installations", normalSide: AccountNormalSide.CREDIT },
  // Classe 3 — Stocks (nouveau, lié au chantier CMV/valorisation).
  { code: "311", label: "Marchandises", normalSide: AccountNormalSide.DEBIT },
  { code: "603", label: "Variation de stocks de marchandises", normalSide: AccountNormalSide.DEBIT },
  // Classe 4 — complément tiers.
  { code: "409", label: "Fournisseurs débiteurs (avances et acomptes versés)", normalSide: AccountNormalSide.DEBIT },
  { code: "419", label: "Clients créditeurs (avances et acomptes reçus)", normalSide: AccountNormalSide.CREDIT },
  { code: "421", label: "Personnel — rémunérations dues", normalSide: AccountNormalSide.CREDIT },
  { code: "431", label: "Sécurité sociale", normalSide: AccountNormalSide.CREDIT },
  { code: "441", label: "État — impôts sur les bénéfices", normalSide: AccountNormalSide.CREDIT },
  { code: "443", label: "État — TVA facturée (collectée)", normalSide: AccountNormalSide.CREDIT },
  { code: "445", label: "État — TVA récupérable (déductible)", normalSide: AccountNormalSide.DEBIT },
  { code: "447", label: "État — autres impôts et taxes", normalSide: AccountNormalSide.CREDIT },
  // Classe 5 — complément trésorerie (lié au chantier trésorerie multi-comptes).
  { code: "521", label: "Banques", normalSide: AccountNormalSide.DEBIT },
  { code: "532", label: "Mobile money", normalSide: AccountNormalSide.DEBIT },
  // Classe 6 — complément charges.
  { code: "605", label: "Autres achats", normalSide: AccountNormalSide.DEBIT },
  { code: "622", label: "Locations", normalSide: AccountNormalSide.DEBIT },
  { code: "624", label: "Entretien et réparations", normalSide: AccountNormalSide.DEBIT },
  { code: "628", label: "Divers — services extérieurs", normalSide: AccountNormalSide.DEBIT },
  { code: "664", label: "Charges sociales", normalSide: AccountNormalSide.DEBIT },
  // Classe 7 — complément produits.
  { code: "706", label: "Produits accessoires", normalSide: AccountNormalSide.CREDIT },
  { code: "758", label: "Produits divers", normalSide: AccountNormalSide.CREDIT },
  // Classe 8 — HAO (hors activités ordinaires).
  { code: "831", label: "Charges HAO", normalSide: AccountNormalSide.DEBIT },
  { code: "841", label: "Produits HAO", normalSide: AccountNormalSide.CREDIT },
];

const COMPTES_ELEGANZ: SeedAccount[] = [
  { code: "5711", label: "Caisse / trésorerie ELEGANZ USD", normalSide: AccountNormalSide.DEBIT },
  { code: "5712", label: "Caisse / trésorerie ELEGANZ CDF", normalSide: AccountNormalSide.DEBIT },
  { code: "411", label: "Boutiques — sommes dues à ELEGANZ", normalSide: AccountNormalSide.DEBIT },
  { code: "706", label: "Produits des abonnements et services", normalSide: AccountNormalSide.CREDIT },

  // Ajoutés le 18 oct. 2026 (audit du 18 oct. 2026, point 6 : "Trésorerie
  // multi-comptes et immobilisations plateforme absentes") — la liste
  // existante n'avait que des comptes d'amortissement spécifiques par
  // catégorie (2811 incorporelles, 2818 agencements), alors que
  // AssetsService (immobilisations plateforme) a besoin, comme côté
  // boutique, d'une paire générique dotation/amortissement puisque le
  // modèle Asset ne porte aucune catégorie.
  { code: "681", label: "Dotations aux amortissements", normalSide: AccountNormalSide.DEBIT },
  { code: "2848", label: "Amortissements des autres immobilisations", normalSide: AccountNormalSide.CREDIT },

  // Comptes ajoutés le 14 oct. 2026 — mêmes principes que COMPTES_BOUTIQUE
  // ci-dessus, sans classe 3 (pas de stock de marchandises côté plateforme).
  { code: "101", label: "Capital social ELEGANZ", normalSide: AccountNormalSide.CREDIT },
  { code: "106", label: "Réserves", normalSide: AccountNormalSide.CREDIT },
  { code: "110", label: "Report à nouveau", normalSide: AccountNormalSide.CREDIT },
  { code: "120", label: "Résultat net de l'exercice", normalSide: AccountNormalSide.CREDIT },
  { code: "162", label: "Emprunts auprès des établissements de crédit", normalSide: AccountNormalSide.CREDIT },
  { code: "191", label: "Provisions pour risques", normalSide: AccountNormalSide.CREDIT },
  { code: "211", label: "Immobilisations incorporelles (logiciels)", normalSide: AccountNormalSide.DEBIT },
  { code: "2181", label: "Agencements et installations", normalSide: AccountNormalSide.DEBIT },
  { code: "2811", label: "Amortissements des immobilisations incorporelles", normalSide: AccountNormalSide.CREDIT },
  { code: "2818", label: "Amortissements des agencements et installations", normalSide: AccountNormalSide.CREDIT },
  { code: "409", label: "Fournisseurs débiteurs (avances et acomptes versés)", normalSide: AccountNormalSide.DEBIT },
  { code: "419", label: "Boutiques créditrices (avances et acomptes reçus)", normalSide: AccountNormalSide.CREDIT },
  { code: "421", label: "Personnel — rémunérations dues", normalSide: AccountNormalSide.CREDIT },
  { code: "431", label: "Sécurité sociale", normalSide: AccountNormalSide.CREDIT },
  { code: "441", label: "État — impôts sur les bénéfices", normalSide: AccountNormalSide.CREDIT },
  { code: "443", label: "État — TVA facturée (collectée)", normalSide: AccountNormalSide.CREDIT },
  { code: "445", label: "État — TVA récupérable (déductible)", normalSide: AccountNormalSide.DEBIT },
  { code: "447", label: "État — autres impôts et taxes", normalSide: AccountNormalSide.CREDIT },
  { code: "521", label: "Banques", normalSide: AccountNormalSide.DEBIT },
  { code: "532", label: "Mobile money", normalSide: AccountNormalSide.DEBIT },
  { code: "605", label: "Autres achats", normalSide: AccountNormalSide.DEBIT },
  { code: "622", label: "Locations", normalSide: AccountNormalSide.DEBIT },
  { code: "624", label: "Entretien et réparations", normalSide: AccountNormalSide.DEBIT },
  { code: "628", label: "Divers — services extérieurs", normalSide: AccountNormalSide.DEBIT },
  { code: "664", label: "Charges sociales", normalSide: AccountNormalSide.DEBIT },
  { code: "758", label: "Produits divers", normalSide: AccountNormalSide.CREDIT },
  { code: "831", label: "Charges HAO", normalSide: AccountNormalSide.DEBIT },
  { code: "841", label: "Produits HAO", normalSide: AccountNormalSide.CREDIT },
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
        // findFirst + create n'est pas atomique : deux ventes concurrentes
        // sur une boutique qui n'a encore aucun compte peuvent toutes deux
        // passer le findFirst (null) avant que l'une des deux n'ait fini de
        // créer le compte. La seconde création viole alors la contrainte
        // unique [scope, shopId, code] (schema.prisma) — ignoré
        // volontairement : le compte existe déjà, c'est le résultat voulu.
        await this.prisma.account
          .create({
            data: { scope, shopId, code: compte.code, label: compte.label, normalSide: compte.normalSide },
          })
          .catch((err: unknown) => {
            if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") return;
            throw err;
          });
      }
    }
    for (const journal of JOURNAUX) {
      const existant = await this.prisma.journal.findFirst({
        where: { scope, shopId, code: journal.code },
        select: { id: true },
      });
      if (!existant) {
        // Même course possible que pour les comptes ci-dessus.
        await this.prisma.journal
          .create({
            data: { scope, shopId, code: journal.code, label: journal.label },
          })
          .catch((err: unknown) => {
            if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") return;
            throw err;
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
