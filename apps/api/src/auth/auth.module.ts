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
        // Révisé le 3 nov. 2026 (audit sécurité, décision explicite du
        // propriétaire après l'incident de fuite d'identifiants Railway du
        // 21 oct. 2026) : le choix précédent (20 oct. 2026) était de ne
        // JAMAIS faire échouer le démarrage ici, pour qu'un redémarrage en
        // boucle ne soit pas pire qu'un secret faible le temps de corriger
        // — mais ça laissait l'API tourner en silence avec un secret de
        // secours connu de quiconque lit le code source, permettant de
        // forger des jetons valides pour n'importe quel compte, y compris
        // admin. Après avoir vécu un vrai incident de fuite d'identifiants,
        // le propriétaire a tranché pour la disponibilité moindre : l'API
        // refuse maintenant de démarrer en production si JWT_SECRET est
        // absent, plutôt que de servir du trafic avec une authentification
        // forgeable. Le message d'erreur est explicite pour que la cause
        // soit immédiate dans les logs de déploiement Railway, jamais un
        // simple plantage muet.
        if (!secret) {
          if (config.get<string>("NODE_ENV") === "production") {
            throw new Error(
              "JWT_SECRET n'est pas défini en production — démarrage refusé (décision du 3 nov. 2026 : " +
                "jamais d'authentification avec un secret de secours connu publiquement). " +
                "Définissez JWT_SECRET dans les variables d'environnement Railway, puis redéployez.",
            );
          }
          // Hors production (dev local) : un secret de secours reste
          // acceptable, avec un rappel visible plutôt qu'une erreur bloquante.
          new Logger("AuthModule").warn(
            "JWT_SECRET n'est pas défini — un secret de développement non sécurisé est utilisé. " +
              "Sans conséquence en local, mais ne doit jamais atteindre la production.",
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
