import { Module } from "@nestjs/common";
import { AdminTeamService } from "./admin-team.service";
import { AdminTeamController } from "./admin-team.controller";
import { AuthModule } from "../auth/auth.module";

// AdminTeamController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md (le même
// oubli avait fait planter AdminCockpitModule en production).
@Module({
  imports: [AuthModule],
  providers: [AdminTeamService],
  controllers: [AdminTeamController],
})
export class AdminTeamModule {}
