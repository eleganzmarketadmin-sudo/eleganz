import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ExpensesService } from "./expenses.service";
import { CreateExpenseDto } from "./dto/expense.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";

@Controller("shops/:shopId/expenses")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.expensesService.list(shopId);
  }

  @Post()
  create(@Param("shopId") shopId: string, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(shopId, dto);
  }
}
