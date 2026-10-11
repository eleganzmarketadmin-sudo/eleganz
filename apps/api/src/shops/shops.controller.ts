import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "./shop-membership.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

@Controller("shops")
@UseGuards(JwtAuthGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateShopDto) {
    // Le propriétaire est TOUJOURS l'utilisateur authentifié, jamais un id du corps de la requête.
    return this.shopsService.create(user.id, dto);
  }

  @Get("mine")
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.shopsService.findMine(user.id);
  }

  @Post(":shopId/publish")
  @UseGuards(ShopMembershipGuard)
  publish(@Param("shopId") shopId: string, @Body("productIds") productIds: string[]) {
    return this.shopsService.publishSelection(shopId, productIds);
  }
}
