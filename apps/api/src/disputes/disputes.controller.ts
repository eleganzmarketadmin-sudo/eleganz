import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { DisputesService, ISSUES_LITIGE, type IssueLitige } from "./disputes.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

@Controller()
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post("marketplace/orders/:shopOrderId/dispute")
  openAsBuyer(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopOrderId") shopOrderId: string,
    @Body("reason") reason: string,
  ) {
    return this.disputesService.openAsBuyer(shopOrderId, user.id, reason);
  }

  @Get("shops/:shopId/disputes")
  @UseGuards(ShopMembershipGuard)
  listForShop(@Param("shopId") shopId: string) {
    return this.disputesService.listForShop(shopId);
  }

  @Post("shops/:shopId/orders/:shopOrderId/dispute")
  @UseGuards(ShopMembershipGuard)
  openAsShop(
    @Param("shopId") shopId: string,
    @Param("shopOrderId") shopOrderId: string,
    @Body("reason") reason: string,
  ) {
    return this.disputesService.openAsShop(shopOrderId, shopId, reason);
  }

  @Get("admin/disputes")
  listOpen(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.LITIGES);
    return this.disputesService.listOpen();
  }

  @Patch("admin/disputes/:disputeId/resolve")
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("disputeId") disputeId: string,
    @Body("outcome") outcome: IssueLitige,
    @Body("resolution") resolution: string,
  ) {
    requireAdminMenu(user, MenuAdmin.LITIGES);
    if (!ISSUES_LITIGE.includes(outcome)) {
      throw new BadRequestException(`outcome doit être l'un de : ${ISSUES_LITIGE.join(", ")}.`);
    }
    return this.disputesService.resolve(disputeId, outcome, resolution);
  }
}
