import { Module } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { ShopsController } from "./shops.controller";
import { ShopMembershipGuard } from "./shop-membership.guard";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  providers: [ShopsService, ShopMembershipGuard],
  controllers: [ShopsController],
  // Ré-exporte AuthModule (donc JwtAuthGuard) : tout module import ShopsModule
  // obtient à la fois ShopMembershipGuard et JwtAuthGuard en une seule ligne,
  // au lieu de devoir importer les deux modules séparément partout.
  exports: [ShopsService, ShopMembershipGuard, AuthModule],
})
export class ShopsModule {}
