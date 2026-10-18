import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { MenuAdmin } from "@eleganz/database";
import { AdminExportsService } from "./admin-exports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Ces exports sont proposés depuis l'écran Tableau de bord (PILOTAGE) —
// voir audit du 18 oct. 2026 sur la granularité des rôles admin.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.PILOTAGE);
}

function envoyerXlsx(res: Response, buffer: Buffer, nomFichier: string) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nomFichier}"`);
  res.send(buffer);
}

// Centre de pilotage — exports Excel plateforme entière (prompt du 12 oct.
// 2026). Chaque export vérifie le rôle admin lui-même (comme les autres
// contrôleurs admin du projet) plutôt que de dépendre d'un guard partagé.
@Controller("admin/exports")
@UseGuards(JwtAuthGuard)
export class AdminExportsController {
  constructor(private readonly exportsService: AdminExportsService) {}

  @Get("boutiques")
  async boutiques(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    requireAdmin(user);
    envoyerXlsx(res, await this.exportsService.exporterBoutiques(), "boutiques-eleganz.xlsx");
  }

  @Get("produits")
  async produits(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    requireAdmin(user);
    envoyerXlsx(res, await this.exportsService.exporterProduits(), "produits-eleganz.xlsx");
  }

  @Get("commandes")
  async commandes(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    requireAdmin(user);
    envoyerXlsx(res, await this.exportsService.exporterCommandes(), "commandes-eleganz.xlsx");
  }

  @Get("factures")
  async factures(@CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    requireAdmin(user);
    envoyerXlsx(res, await this.exportsService.exporterFactures(), "factures-plateforme-eleganz.xlsx");
  }
}
