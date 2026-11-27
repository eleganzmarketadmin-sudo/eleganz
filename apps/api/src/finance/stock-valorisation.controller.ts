import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { StockValorisationService } from "./stock-valorisation.service";
import { CreateReceptionStockDto } from "./dto/reception-stock.dto";
import { renderStockPdf } from "./stock-pdf-renderer";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { RequiresGestionFeature } from "../shops/gestion-feature.decorator";
import { StaffRole } from "@eleganz/database";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Réceptions de stock valorisées (CUMP) — chantier SYSCOHADA phase 4.
 * Mêmes rôles que les autres écrans de gestion sensible (achats, charges).
 *
 * Réservé aux bouquets Gestion Pro et plus (27 nov. 2026, audit "tous les
 * autres menus/fonctionnalités ajoutés depuis la mise en place des
 * bouquets" — Stock & CMV n'avait jamais été rattaché à `featuresJson`,
 * contrairement à variantesProduits/exportExcelPdf). Gardé en plus (pas à la
 * place) de la vérification "exportExcelPdf" déjà existante sur la route
 * d'export ci-dessous : ce sont deux fonctionnalités distinctes du bouquet
 * (l'accès au module Stock & CMV, et la capacité d'exporter), même si les
 * deux sont aujourd'hui vraies ensemble sur Pro/Premium/Ultime.
 */
@Controller("shops/:shopId/stock")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
@RequiresGestionFeature("stockCmv")
export class StockValorisationController {
  constructor(
    private readonly stock: StockValorisationService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("receptions")
  receptionner(@Param("shopId") shopId: string, @Body() dto: CreateReceptionStockDto) {
    return this.stock.receptionner(shopId, dto);
  }

  @Get("variantes/:variantId/receptions")
  list(@Param("shopId") shopId: string, @Param("variantId") variantId: string) {
    return this.stock.listPourVariante(shopId, variantId);
  }

  // Export Excel/PDF (27 nov. 2026, demande : "possibilité d'exporter en
  // Excel ou pdf") — réservé au bouquet "exportExcelPdf", même vérification
  // inline qu'au même endroit pour les relevés (reports.controller.ts) :
  // l'écran lui-même (JSON implicite, via GET /shops/:shopId/products comme
  // aujourd'hui) reste ouvert à tous les rôles autorisés sur ce contrôleur,
  // seule l'extraction fichier est premium.
  @Get("export")
  async exporter(
    @Param("shopId") shopId: string,
    @Query("format") format: string | undefined,
    @Res() res: Response,
  ) {
    const fmt = (format ?? "xlsx").toLowerCase();
    if (fmt !== "xlsx" && fmt !== "pdf") {
      throw new BadRequestException("Format invalide — xlsx ou pdf.");
    }

    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { name: true, gestionBouquet: { select: { name: true, featuresJson: true } } },
    });
    const features = (shop?.gestionBouquet?.featuresJson as unknown as Record<string, unknown> | undefined) ?? {};
    if (features.exportExcelPdf !== true) {
      throw new ForbiddenException(
        `L'export Excel/PDF n'est pas inclus dans le bouquet ${shop?.gestionBouquet?.name ?? "actuel"} de cette boutique. Passez à un bouquet supérieur depuis le Centre de pilotage pour y accéder.`,
      );
    }

    if (fmt === "xlsx") {
      const buffer = await this.stock.exporterExcel(shopId);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="stock-eleganz.xlsx"');
      return res.send(buffer);
    }

    const lignes = await this.stock.listPourExport(shopId);
    const doc = renderStockPdf(lignes, shop?.name ?? "Votre boutique");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="stock-eleganz.pdf"');
    return doc.pipe(res);
  }
}
