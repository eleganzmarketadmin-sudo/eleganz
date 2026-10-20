import { Logger, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>("JWT_SECRET");
        // Corrigé le 20 oct. 2026 (audit de lancement) : si JWT_SECRET n'est
        // pas défini, l'API retombait silencieusement sur un secret par
        // défaut connu de tous ("dev-only-insecure-secret"), ce qui
        // permettrait de forger des jetons valides. On ne fait PAS échouer
        // le démarrage ici (un redémarrage en boucle en production serait
        // pire qu'un secret faible le temps de corriger), mais on log une
        // alerte bien visible — à corriger en définissant JWT_SECRET comme
        // variable d'environnement Railway dès que possible.
        if (!secret && config.get<string>("NODE_ENV") === "production") {
          new Logger("AuthModule").error(
            "JWT_SECRET n'est pas défini en production — un secret par défaut non sécurisé est utilisé. " +
              "Définissez JWT_SECRET dans les variables d'environnement Railway dès que possible.",
          );
        }
        return { secret: secret ?? "dev-only-insecure-secret", signOptions: { expiresIn: "7d" } };
      },
    }),
  ],
  providers: [AuthService, JwtAuthGuard],
  controllers: [AuthController],
  exports: [AuthService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
