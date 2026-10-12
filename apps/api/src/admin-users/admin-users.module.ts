import { Module } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { AdminUsersController } from "./admin-users.controller";
import { AuthModule } from "../auth/auth.module";

// AdminUsersController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
@Module({
  imports: [AuthModule],
  providers: [AdminUsersService],
  controllers: [AdminUsersController],
})
export class AdminUsersModule {}
