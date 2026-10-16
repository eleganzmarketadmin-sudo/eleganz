import { Module } from "@nestjs/common";
import { AdminTeamService } from "./admin-team.service";
import { AdminTeamController } from "./admin-team.controller";
import { PlatformExpertsService } from "./platform-experts.service";
import { AdminExpertsController, PlatformExpertInvitesController } from "./platform-experts.controller";
import { AuthModule } from "../auth/auth.module";

// AdminTeamController et les contrôleurs Experts plateforme ci-dessous
// utilisent @UseGuards(JwtAuthGuard), qui dépend de JwtService (fourni par
// AuthModule) — voir docs/MAINTENANCE.md (le même oubli avait fait planter
// AdminCockpitModule en production).
@Module({
  imports: [AuthModule],
  providers: [AdminTeamService, PlatformExpertsService],
  controllers: [AdminTeamController, AdminExpertsController, PlatformExpertInvitesController],
})
export class AdminTeamModule {}
