import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { PosService } from "./pos.service";
import { CreateSaleDto } from "./dto/create-sale.dto";

// TODO : brancher le guard JWT (le caissier authentifié doit correspondre à
// `dto.cashierId`, et appartenir à `shopId` — voir TODO dans shops.controller.ts).
@Controller("shops/:shopId/pos")
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post("sales")
  createSale(@Param("shopId") shopId: string, @Body() dto: CreateSaleDto) {
    return this.posService.createSale(shopId, dto);
  }

  @Post("sales/:saleId/cancel")
  cancelSale(@Param("saleId") saleId: string) {
    return this.posService.cancelSale(saleId);
  }

  @Get("dashboard/daily")
  dailyDashboard(@Param("shopId") shopId: string, @Query("date") date?: string) {
    return this.posService.dailyDashboard(shopId, date ? new Date(date) : undefined);
  }
}
