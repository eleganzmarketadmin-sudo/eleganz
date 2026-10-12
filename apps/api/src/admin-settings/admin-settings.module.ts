import { Module } from "@nestjs/common";
import { AdminSettingsService } from "./admin-settings.service";
import { AdminSettingsController } from "./admin-settings.controller";
import { AuthModule } from "../auth/auth.module";

// AdminSettingsController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
@Module({
  imports: [AuthModule],
  providers: [AdminSettingsService],
  controllers: [AdminSettingsController],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
