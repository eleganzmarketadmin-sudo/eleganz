import { Module } from "@nestjs/common";
import { ModerationService } from "./moderation.service";
import { ModerationController } from "./moderation.controller";
import { AuthModule } from "../auth/auth.module";

// Importe AuthModule : ModerationController utilise @UseGuards(JwtAuthGuard),
// qui dépend de JwtService (fourni par AuthModule) — voir le même
// commentaire dans notifications.module.ts (docs/MAINTENANCE.md).
@Module({
  imports: [AuthModule],
  providers: [ModerationService],
  controllers: [ModerationController],
})
export class ModerationModule {}
