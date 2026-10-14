import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { RelancesService } from "./relances.service";
import { CreateRelanceDto } from "./dto/relance.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole } from "@eleganz/database";

@Controller("shops/:shopId/relances")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
@ShopRoles(StaffRole.OWNER, StaffRole.MANAGER, StaffRole.ACCOUNTANT)
export class RelancesController {
  constructor(private readonly relances: RelancesService) {}

  @Get()
  list(@Param("shopId") shopId: string) {
    return this.relances.list(shopId);
  }

  @Post()
  create(@Param("shopId") shopId: string, @Body() dto: CreateRelanceDto) {
    return this.relances.create(shopId, dto);
  }
}
