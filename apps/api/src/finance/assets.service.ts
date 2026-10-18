import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { CreateAssetDto } from "./dto/asset.dto";
import { FiscalRuleScope } from "@eleganz/database";

function moisEntre(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function debutDuMois(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

export type StatutDotation = "comptabilise" | "deja_comptabilise" | "termine";

/**
 * Immobilisations et amortissements (docs/ARCHITECTURE_FINANCE.md
 * §8quater) — amortissement linéaire uniquement, comptabilisé via
 * AccountingService. Aucun scheduler serveur à cette phase : la
 * comptabilisation d'un mois est une action explicite déclenchée par
 * l'utilisateur dans l'écran Immobilisations, jamais une tâche automatique
 * silencieuse — ce serait présenter comme construit quelque chose qui ne
 * tourne pas réellement.
 *
 * Généralisé au scope PLATFORM le 18 oct. 2026 (audit du 18 oct. 2026,
 * point 6 : "Trésorerie multi-comptes et immobilisations plateforme
 * absentes") — même pattern que FiscalRulesService : chaque méthode
 * publique "ForShop"/"ForPlatform" filtre systématiquement sur son scope,
 * jamais l'un ne peut lire/écrire l'autre.
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async create(shopId: string, dto: CreateAssetDto) {
    return this.creer(FiscalRuleScope.SHOP, shopId, dto);
  }

  listForShop(shopId: string) {
    return this.lister(FiscalRuleScope.SHOP, shopId);
  }

  async dispose(shopId: string, assetId: string) {
    return this.mettreAuRebut(FiscalRuleScope.SHOP, shopId, assetId);
  }

  async runDepreciationForMonth(shopId: string, periodDate: Date) {
    return this.comptabiliserDotations(FiscalRuleScope.SHOP, shopId, periodDate);
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  async createForPlatform(dto: CreateAssetDto) {
    return this.creer(FiscalRuleScope.PLATFORM, null, dto);
  }

  listForPlatform() {
    return this.lister(FiscalRuleScope.PLATFORM, null);
  }

  async disposeForPlatform(assetId: string) {
    return this.mettreAuRebut(FiscalRuleScope.PLATFORM, null, assetId);
  }

  async runDepreciationForMonthPlatform(periodDate: Date) {
    return this.comptabiliserDotations(FiscalRuleScope.PLATFORM, null, periodDate);
  }

  // --- Logique partagée ----------------------------------------------------

  private async creer(scope: FiscalRuleScope, shopId: string | null, dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        scope,
        shopId,
        label: dto.label,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        durationMonths: dto.durationMonths,
      },
    });
  }

  private lister(scope: FiscalRuleScope, shopId: string | null) {
    return this.prisma.asset.findMany({
      where: { scope, shopId },
      include: { depreciations: { orderBy: { periodDate: "desc" } } },
      orderBy: { acquisitionDate: "desc" },
    });
  }

  private async getOwned(scope: FiscalRuleScope, shopId: string | null, assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException("Immobilisation introuvable.");
    if (asset.scope !== scope || asset.shopId !== shopId) {
      throw new ForbiddenException("Cette immobilisation n'appartient pas à ce périmètre.");
    }
    return asset;
  }

  private async mettreAuRebut(scope: FiscalRuleScope, shopId: string | null, assetId: string) {
    await this.getOwned(scope, shopId, assetId);
    return this.prisma.asset.update({
      where: { id: assetId },
      data: { disposed: true, disposedAt: new Date() },
    });
  }

  /**
   * Comptabilise la dotation aux amortissements du mois `periodDate` pour
   * chaque immobilisation active du périmètre (boutique ou plateforme) dont
   * l'acquisition est antérieure et dont la durée n'est pas encore écoulée.
   * Idempotent par actif et par mois (contrainte d'unicité sur
   * AssetDepreciation).
   */
  private async comptabiliserDotations(scope: FiscalRuleScope, shopId: string | null, periodDate: Date) {
    const debut = debutDuMois(periodDate);
    const actifs = await this.prisma.asset.findMany({
      where: { scope, shopId, disposed: false, acquisitionDate: { lte: debut } },
    });

    const resultats: { assetId: string; label: string; montant: number; statut: StatutDotation }[] = [];
    for (const actif of actifs) {
      const moisEcoules = moisEntre(actif.acquisitionDate, debut);
      if (moisEcoules >= actif.durationMonths) {
        resultats.push({ assetId: actif.id, label: actif.label, montant: 0, statut: "termine" });
        continue;
      }
      const montant = Math.round((Number(actif.acquisitionCost) / actif.durationMonths) * 100) / 100;
      const dejaExistant = await this.prisma.assetDepreciation.findFirst({
        where: { assetId: actif.id, periodDate: debut },
      });
      if (dejaExistant) {
        resultats.push({ assetId: actif.id, label: actif.label, montant, statut: "deja_comptabilise" });
        continue;
      }
      // L'écriture comptable est posée AVANT la ligne de déduplication
      // (pas l'inverse) : si postAssetDepreciation échoue (période clôturée,
      // ou toute autre erreur), aucune ligne AssetDepreciation n'est créée et
      // un nouvel essai reste possible. Voir le commentaire original
      // (14 oct. 2026) sur l'incident déjà documenté dans
      // docs/PLAN_COMMERCIAL.md pour l'ordre inverse qui perdait des
      // dotations silencieusement.
      await this.accounting.postAssetDepreciation(scope, shopId, actif, debut, montant);
      await this.prisma.assetDepreciation.create({
        data: { assetId: actif.id, periodDate: debut, amount: montant },
      });
      resultats.push({ assetId: actif.id, label: actif.label, montant, statut: "comptabilise" });
    }
    return resultats;
  }
}
