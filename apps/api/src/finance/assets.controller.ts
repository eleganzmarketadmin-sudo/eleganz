import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { AssetsService } from "./assets.service";
import { CreateAssetDto } from "./dto/asset.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
import { StaffRole } from "@eleganz/database";

/**
 * Immobilisations et amortissements — docs/ARCHITECTURE_FINANCE.md
 * §8quater. Lecture ouverte à tout membre actif de la boutique, écriture
 * (création, mise au rebut, comptabilisation des dotations) réservée à
 * OWNER/MANAGER/ACCOUNTANT, comme pour les charges et règles fiscales.
 * Réservé au bouquet Premium depuis le plan commercial du 14 oct. 2026
 * (voir docs/PLAN_COMMERCIAL.md) — décorateur de classe, donc toute route
 * ajoutée plus tard sous ce contrôleur est automatiquement couverte.
 */
@Controller("shops/:shopId/assets")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@RequiresGestionFeature("immobilisations")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.assetsService.listForShop(shopId);
  }

  @Post()
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  create(@Param("shopId") shopId: string, @Body() dto: CreateAssetDto) {
    return this.assetsService.create(shopId, dto);
  }

  @Post(":assetId/mise-au-rebut")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  dispose(@Param("shopId") shopId: string, @Param("assetId") assetId: string) {
    return this.assetsService.dispose(shopId, assetId);
  }

  // `period` au format AAAA-MM, mois courant par défaut.
  @Post("depreciation/run")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  runDepreciation(@Param("shopId") shopId: string, @Query("period") period?: string) {
    const periodDate = period ? new Date(`${period}-01T00:00:00.000Z`) : new Date();
    return this.assetsService.runDepreciationForMonth(shopId, periodDate);
  }
}
