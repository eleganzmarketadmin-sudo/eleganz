import { Module } from "@nestjs/common";
import { PasswordResetService } from "./password-reset.service";
import { EmailSenderService } from "./email-sender.service";
import { WhatsAppSenderService } from "./whatsapp-sender.service";
import { PasswordResetController, AdminPasswordResetController } from "./password-reset.controller";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

// AdminPasswordResetController utilise @UseGuards(JwtAuthGuard), qui
// dépend de JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
// PasswordResetController (public) n'en a pas besoin, mais vit dans le
// même module pour rester avec son service.
@Module({
  imports: [AuthModule, NotificationsModule],
  providers: [PasswordResetService, EmailSenderService, WhatsAppSenderService],
  controllers: [PasswordResetController, AdminPasswordResetController],
})
export class PasswordResetModule {}
