import { Module } from "@nestjs/common";
import { AdminCockpitService } from "./admin-cockpit.service";
import { AdminCockpitController } from "./admin-cockpit.controller";
import { AuthModule } from "../auth/auth.module";

// AdminCockpitController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par JwtModule, importé/exporté par AuthModule) — sans cet
// import, Nest ne peut pas résoudre les dépendances de JwtAuthGuard au
// démarrage et le service plante (voir docs/MAINTENANCE.md).
@Module({
  imports: [AuthModule],
  providers: [AdminCockpitService],
  controllers: [AdminCockpitController],
})
export class AdminCockpitModule {}
