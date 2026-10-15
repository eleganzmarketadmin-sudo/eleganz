import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { AuthModule } from "../auth/auth.module";

// Importe AuthModule : NotificationsController utilise @UseGuards(JwtAuthGuard),
// qui dépend de JwtService (fourni par AuthModule). Sans cet import, Nest ne
// démarre pas du tout — incident documenté dans docs/MAINTENANCE.md
// ("Piège fréquent : tout nouveau module avec @UseGuards(JwtAuthGuard) doit
// importer AuthModule").
@Module({
  imports: [AuthModule],
  providers: [NotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
