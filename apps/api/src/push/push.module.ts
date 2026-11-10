import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PushController } from "./push.controller";
import { PushSenderService } from "./push-sender.service";
import { PushSubscriptionsService } from "./push-subscriptions.service";

// Importe AuthModule : PushController utilise @UseGuards(JwtAuthGuard) sur
// deux de ses trois routes (voir docs/MAINTENANCE.md, "piège fréquent").
@Module({
  imports: [AuthModule],
  providers: [PushSenderService, PushSubscriptionsService],
  controllers: [PushController],
  exports: [PushSenderService, PushSubscriptionsService],
})
export class PushModule {}
