import { Controller, ForbiddenException, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AdminExportsService } from "./admin-exports.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'équipe ELEGANZ.");
  }
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
