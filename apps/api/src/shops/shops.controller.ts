import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { CreateShopDto } from "./dto/create-shop.dto";

// TODO (phase socle) : remplacer `ownerId` en paramètre par un guard JWT qui
// lit l'utilisateur authentifié — laissé explicite ici pour que la prochaine
// session voie immédiatement où brancher l'authentification réelle.
@Controller("shops")
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Post(":ownerId")
  create(@Param("ownerId") ownerId: string, @Body() dto: CreateShopDto) {
    return this.shopsService.create(ownerId, dto);
  }

  @Get("owner/:ownerId")
  findMine(@Param("ownerId") ownerId: string) {
    return this.shopsService.findMine(ownerId);
  }

  @Post(":shopId/publish")
  publish(@Param("shopId") shopId: string, @Body("productIds") productIds: string[]) {
    return this.shopsService.publishSelection(shopId, productIds);
  }
}
