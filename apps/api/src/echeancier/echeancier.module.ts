import { Module } from "@nestjs/common";
import { EcheancierService } from "./echeancier.service";
import { EcheancierController } from "./echeancier.controller";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";

// AuthModule importé directement : EcheancierController a son propre
// @UseGuards(JwtAuthGuard), qui a besoin de JwtService dans CE module (même
// piège documenté dans notifications.module.ts / docs/MAINTENANCE.md).
@Module({
  imports: [NotificationsModule, AuthModule],
  providers: [EcheancierService],
  controllers: [EcheancierController],
  exports: [EcheancierService],
})
export class EcheancierModule {}
