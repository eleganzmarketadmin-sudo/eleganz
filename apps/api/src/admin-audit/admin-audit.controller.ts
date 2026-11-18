import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { AdminAuditService } from "./admin-audit.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Réservé au menu AUDIT (18 nov. 2026) — voir le commentaire sur
// MenuAdmin.AUDIT dans schema.prisma : accordé par défaut seulement à
// ADMIN_SUPER et ADMIN_AUDITOR, jamais à tous les rôles admin comme
// CENTRE_AIDE.
@Controller("admin/audit-log")
@UseGuards(JwtAuthGuard)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get()
  lister(
    @CurrentUser() user: AuthenticatedUser,
    @Query("action") action?: string,
    @Query("actorId") actorId?: string,
    @Query("shopId") shopId?: string,
    @Query("cursor") cursor?: string,
  ) {
    requireAdminMenu(user, MenuAdmin.AUDIT);
    return this.adminAuditService.lister({ action, actorId, shopId, cursor });
  }

  @Get("actions")
  actionsDistinctes(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.AUDIT);
    return this.adminAuditService.actionsDistinctes();
  }
}
