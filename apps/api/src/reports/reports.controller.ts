import { Controller, ForbiddenException, Get, Param, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { renderReleveActivitePdf } from "./report-pdf-renderer";
import { parseReleveQuery } from "./parse-releve-query";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Relevés d'activité périodiques pour le vendeur lui-même (demande du
 * 12 oct. 2026, point 3) — même moteur que le relevé admin
 * (admin-reports.controller.ts), restreint à sa propre boutique.
 */
@Controller("shops/:shopId/reports")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("releve")
  async releve(
    @Param("shopId") shopId: string,
    @Query() query: { from?: string; to?: string; granularite?: string; regroupement?: string; format?: string },
    @Res() res: Response,
  ) {
    const params = parseReleveQuery(query);

    // Réservé au bouquet "exportExcelPdf" (14 oct. 2026, plan commercial) —
    // seulement les formats fichier : la vue à l'écran (format JSON, par
    // défaut) reste ouverte à tous, ce n'est que l'extraction qui est
    // premium. Vérification faite ici (pas via @RequiresGestionFeature, qui
    // s'applique à toute la route) car la même route sert les deux usages
    // selon ?format=.
    if (params.format === "xlsx" || params.format === "pdf") {
      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
        select: { gestionBouquet: { select: { name: true, featuresJson: true } } },
      });
      const features = (shop?.gestionBouquet?.featuresJson as unknown as Record<string, unknown> | undefined) ?? {};
      if (features.exportExcelPdf !== true) {
        throw new ForbiddenException(
          `L'export Excel/PDF n'est pas inclus dans le bouquet ${shop?.gestionBouquet?.name ?? "actuel"} de cette boutique. Passez à un bouquet supérieur depuis le Centre de pilotage pour y accéder.`,
        );
      }
    }

    const releve = await this.reportsService.genererReleve({ ...params, shopId });

    if (params.format === "xlsx") {
      const buffer = this.reportsService.exporterExcel(releve);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="releve-activite-eleganz.xlsx"');
      return res.send(buffer);
    }
    if (params.format === "pdf") {
      const doc = renderReleveActivitePdf(releve, releve.shopName ?? "Votre boutique");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="releve-activite-eleganz.pdf"');
      return doc.pipe(res);
    }
    return res.json(releve);
  }
}
