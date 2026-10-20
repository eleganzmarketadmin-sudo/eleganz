import { Body, Controller, ForbiddenException, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { PosService } from "./pos.service";
import { CreateSaleDto, SyncSaleDto } from "./dto/create-sale.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("shops/:shopId/pos")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post("sales")
  createSale(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSaleDto,
  ) {
    // Le caissier est TOUJOURS l'utilisateur authentifié — dto.cashierId est
    // ignoré s'il diffère, pour empêcher d'attribuer une vente à quelqu'un d'autre.
    if (dto.cashierId && dto.cashierId !== user.id) {
      throw new ForbiddenException("cashierId doit correspondre à l'utilisateur authentifié.");
    }
    return this.posService.createSale(shopId, { ...dto, cashierId: user.id });
  }

  @Post("sales/sync")
  syncSale(
    @Param("shopId") shopId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SyncSaleDto,
  ) {
    // Même garde qu'en vente directe : le caissier est toujours l'utilisateur
    // authentifié, jamais une valeur reçue de l'appareil.
    return this.posService.syncOfflineSale(shopId, { ...dto, cashierId: user.id });
  }

  @Post("sales/:saleId/cancel")
  // Corrigé le 20 oct. 2026 (audit de lancement) : réservée à OWNER/MANAGER,
  // plus ouverte à tout caissier — voir le commentaire de PosService.cancelSale.
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  cancelSale(@Param("shopId") shopId: string, @Param("saleId") saleId: string) {
    return this.posService.cancelSale(shopId, saleId);
  }

  @Get("stock-discrepancies")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.STOCK_KEEPER, StaffRole.ACCOUNTANT)
  listStockDiscrepancies(@Param("shopId") shopId: string) {
    return this.posService.listStockDiscrepancies(shopId);
  }

  @Get("dashboard/daily")
  // Révèle la marge : réservé à ceux qui ont une vue financière sur la boutique
  // (prompt §10 — le caissier n'a pas accès à toutes les données confidentielles).
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
  dailyDashboard(@Param("shopId") shopId: string, @Query("date") date?: string) {
    return this.posService.dailyDashboard(shopId, date ? new Date(date) : undefined);
  }
}
