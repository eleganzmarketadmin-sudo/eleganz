import { Module } from "@nestjs/common";
import { MessagingService } from "./messaging.service";
import { MessagingController } from "./messaging.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";

// AuthModule importé directement (et pas seulement via NotificationsModule) :
// MessagingController a son propre @UseGuards(JwtAuthGuard), qui a besoin de
// JwtService dans CE module — voir le même piège documenté dans
// notifications.module.ts / docs/MAINTENANCE.md.
@Module({
  imports: [NotificationsModule, AuthModule],
  providers: [MessagingService],
  controllers: [MessagingController],
  exports: [MessagingService],
})
export class MessagingModule {}
