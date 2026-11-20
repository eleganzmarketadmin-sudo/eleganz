import { Module } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { PublicPlatformFeaturesController } from "./public-platform-features.controller";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";

// AdminSettingsController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
// PublicPlatformFeaturesController n'a besoin d'aucun guard (lecture
// publique), mais vit dans le même module pour réutiliser le même service.
// StorageModule (20 nov. 2026) : upload direct du logo plateforme vers R2,
// même principe que les autres écrans Paramètres (Institution/Comptable).
@Module({
  imports: [AuthModule, StorageModule],
  providers: [AdminSettingsService],
  controllers: [AdminSettingsController, PublicPlatformFeaturesController],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
