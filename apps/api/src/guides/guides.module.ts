import { Module } from "@nestjs/common";
import { GuidesService } from "./guides.service";
import { GuidesController } from "./guides.controller";
import { GuidesPublicController, GuidesPublicFaqController } from "./guides-public.controller";
import { StorageModule } from "../storage/storage.module";
import { AuthModule } from "../auth/auth.module";

// AuthModule est requis explicitement (10 nov. 2026, crash de déploiement
// corrigé) : JwtAuthGuard — utilisé par GuidesController — dépend de
// JwtService, fourni par JwtModule.registerAsync() dans AuthModule.
// AuthModule n'est pas @Global() ; d'autres modules (ShopsModule) l'ont
// importé ET ré-exporté pour que tout module qui les importe en hérite
// transitivement, mais GuidesModule n'a aucune raison d'importer
// ShopsModule — plus simple et plus direct de l'importer ici directement.
@Module({
  imports: [StorageModule, AuthModule],
  controllers: [GuidesController, GuidesPublicController, GuidesPublicFaqController],
  providers: [GuidesService],
})
export class GuidesModule {}
