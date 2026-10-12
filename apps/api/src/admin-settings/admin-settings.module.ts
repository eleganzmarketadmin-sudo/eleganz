import { Module } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { PublicPlatformFeaturesController } from "./public-platform-features.controller";
import { AuthModule } from "../auth/auth.module";

// AdminSettingsController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
// PublicPlatformFeaturesController n'a besoin d'aucun guard (lecture
// publique), mais vit dans le même module pour réutiliser le même service.
@Module({
  imports: [AuthModule],
  providers: [AdminSettingsService],
  controllers: [AdminSettingsController, PublicPlatformFeaturesController],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
