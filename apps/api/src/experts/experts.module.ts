import { Module } from "@nestjs/common";
import { ExpertsService } from "./experts.service";
import { ExpertsController, ShopExpertsController } from "./experts.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";
import { ShopsModule } from "../shops/shops.module";

// Module EXPERTS (16 oct. 2026, point 2). AuthModule ET ShopsModule importés
// directement : ExpertsController pose son propre @UseGuards(JwtAuthGuard)
// (a besoin de JwtService ici même), et ShopExpertsController a besoin en
// plus de ShopMembershipGuard — même piège déjà documenté dans
// docs/MAINTENANCE.md (incident AuthModule) pour tout contrôleur qui pose
// ses guards directement plutôt que d'hériter d'un module global.
@Module({
  imports: [NotificationsModule, AuthModule, ShopsModule],
  providers: [ExpertsService],
  controllers: [ExpertsController, ShopExpertsController],
  exports: [ExpertsService],
})
export class ExpertsModule {}
