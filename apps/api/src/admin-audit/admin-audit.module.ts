import { Module } from "@nestjs/common";
import { AdminAuditService } from "./admin-audit.service";
import { AdminAuditController } from "./admin-audit.controller";
import { AuthModule } from "../auth/auth.module";

// AdminAuditController utilise @UseGuards(JwtAuthGuard), qui dépend de
// JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
@Module({
  imports: [AuthModule],
  providers: [AdminAuditService],
  controllers: [AdminAuditController],
})
export class AdminAuditModule {}
