import { Module } from "@nestjs/common";
import { PasswordResetService } from "./password-reset.service";
import { PasswordResetController, AdminPasswordResetController } from "./password-reset.controller";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";

// AdminPasswordResetController utilise @UseGuards(JwtAuthGuard), qui
// dépend de JwtService (fourni par AuthModule) — voir docs/MAINTENANCE.md.
// PasswordResetController (public) n'en a pas besoin, mais vit dans le
// même module pour rester avec son service.
//
// EmailSenderService/WhatsAppSenderService/SmsSenderService ont été
// déplacés dans NotificationsModule (16 nov. 2026, chantier relances/
// recouvrement — voir son commentaire) : NotificationsModule est déjà
// importé ci-dessous, donc PasswordResetService les reçoit par injection
// sans qu'il faille les redéclarer ici.
@Module({
  imports: [AuthModule, NotificationsModule],
  providers: [PasswordResetService],
  controllers: [PasswordResetController, AdminPasswordResetController],
})
export class PasswordResetModule {}
