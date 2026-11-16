import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { AuthModule } from "../auth/auth.module";
import { PushModule } from "../push/push.module";
import { EmailSenderService } from "./channels/email-sender.service";
import { SmsSenderService } from "./channels/sms-sender.service";
import { WhatsAppSenderService } from "./channels/whatsapp-sender.service";

// Importe AuthModule : NotificationsController utilise @UseGuards(JwtAuthGuard),
// qui dépend de JwtService (fourni par AuthModule). Sans cet import, Nest ne
// démarre pas du tout — incident documenté dans docs/MAINTENANCE.md
// ("Piège fréquent : tout nouveau module avec @UseGuards(JwtAuthGuard) doit
// importer AuthModule").
//
// EmailSenderService/SmsSenderService/WhatsAppSenderService ont été
// déplacés ici depuis password-reset/ (16 nov. 2026, chantier relances/
// recouvrement) : ils étaient déjà des envoyeurs génériques (contrat
// estConfigure()/envoyer(), sans rien de spécifique à l'OTP), seulement
// câblés jusqu'ici pour un seul appelant. PasswordResetModule continue de
// les utiliser en important NotificationsModule plutôt qu'en les
// redéclarant comme providers locaux.
@Module({
  imports: [AuthModule, PushModule],
  providers: [NotificationsService, EmailSenderService, SmsSenderService, WhatsAppSenderService],
  controllers: [NotificationsController],
  exports: [NotificationsService, EmailSenderService, SmsSenderService, WhatsAppSenderService],
})
export class NotificationsModule {}
