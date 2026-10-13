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
 */
@Injectable()
export class AssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  async create(shopId: string, dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        scope: FiscalRuleScope.SHOP,
        shopId,
        label: dto.label,
        acquisitionDate: new Date(dto.acquisitionDate),
        acquisitionCost: dto.acquisitionCost,
        durationMonths: dto.durationMonths,
      },
    });
  }

  listForShop(shopId: string) {
    return this.prisma.asset.findMany({
      where: { scope: FiscalRuleScope.SHOP, shopId },
      include: { depreciations: { orderBy: { periodDate: "desc" } } },
      orderBy: { acquisitionDate: "desc" },
    });
  }

  private async getOwned(shopId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException("Immobilisation introuvable.");
    if (asset.shopId !== shopId) throw new ForbiddenException("Cette immobilisation n'appartient pas à cette boutique.");
    return asset;
  }

  async dispose(shopId: string, assetId: string) {
    await this.getOwned(shopId, assetId);
    return this.prisma.asset.update({
      where: { id: assetId },
      data: { disposed: true, disposedAt: new Date() },
    });
  }

  /**
   * Comptabilise la dotation aux amortissements du mois `periodDate` pour
   * chaque immobilisation active de la boutique dont l'acquisition est
   * antérieure et dont la durée n'est pas encore écoulée. Idempotent par
   * actif et par mois (contrainte d'unicité sur AssetDepreciation).
   */
  async runDepreciationForMonth(shopId: string, periodDate: Date) {
    const debut = debutDuMois(periodDate);
    const actifs = await this.prisma.asset.findMany({
      where: { scope: FiscalRuleScope.SHOP, shopId, disposed: false, acquisitionDate: { lte: debut } },
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
      await this.prisma.assetDepreciation.create({
        data: { assetId: actif.id, periodDate: debut, amount: montant },
      });
      await this.accounting.postAssetDepreciation(shopId, actif, debut, montant);
      resultats.push({ assetId: actif.id, label: actif.label, montant, statut: "comptabilise" });
    }
    return resultats;
  }
}
