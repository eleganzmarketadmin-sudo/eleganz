import { Controller, ForbiddenException, Get, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { ReportsService } from "./reports.service";
import { renderReleveActivitePdf } from "./report-pdf-renderer";
import { parseReleveQuery } from "./parse-releve-query";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

/**
 * Relevés d'activité périodiques côté Centre de pilotage (demande du
 * 12 oct. 2026, point 2) : pour UNE boutique précise (shopId fourni) ou
 * pour la plateforme entière (shopId omis — alors seul le regroupement
 * BOUTIQUE a un sens pour éclater les chiffres par vendeur).
 */
@Controller("admin/reports")
@UseGuards(JwtAuthGuard)
export class AdminReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("releve")
  async releve(
    @CurrentUser() user: AuthenticatedUser,
    @Query()
    query: {
      shopId?: string;
      from?: string;
      to?: string;
      granularite?: string;
      regroupement?: string;
      format?: string;
    },
    @Res() res: Response,
  ) {
    requireAdmin(user);
    const params = parseReleveQuery(query);
    const releve = await this.reportsService.genererReleve({ ...params, shopId: query.shopId || undefined });

    if (params.format === "xlsx") {
      const buffer = this.reportsService.exporterExcel(releve);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="releve-activite-eleganz.xlsx"');
      return res.send(buffer);
    }
    if (params.format === "pdf") {
      const doc = renderReleveActivitePdf(releve, releve.shopName ?? "Toutes boutiques (plateforme entière)");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="releve-activite-eleganz.pdf"');
      return doc.pipe(res);
    }
    return res.json(releve);
  }
}
