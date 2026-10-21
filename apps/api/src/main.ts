import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import helmet from "helmet";
import { AppModule } from "./app.module";

// 21 oct. 2026 (audit sécurité/IT) : `app.enableCors()` sans options
// acceptait n'importe quelle origine (reflète Access-Control-Allow-Origin
// sur la requête, donc équivalent à "*" en pratique) — un site tiers
// pouvait appeler l'API au nom d'un visiteur. Le jeton d'auth vit dans
// localStorage et est envoyé via l'en-tête Authorization (jamais un
// cookie, voir apps/web/app/lib/api.ts), donc pas de CSRF classique, mais
// une origine ouverte reste une mauvaise pratique et élargit la surface si
// une faille XSS apparaît un jour ailleurs sur la plateforme. Liste
// configurable par variable d'environnement (CORS_ALLOWED_ORIGINS, séparée
// par des virgules) pour pouvoir ajouter un domaine sans toucher au code ;
// valeur de départ = les deux domaines de production connus.
const ORIGINES_PRODUCTION_PAR_DEFAUT = ["https://www.eleganzmarket.com", "https://eleganzmarket.com"];

function originesAutorisees(): string[] {
  const depuisEnv = process.env.CORS_ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  const origines = depuisEnv && depuisEnv.length > 0 ? depuisEnv : ORIGINES_PRODUCTION_PAR_DEFAUT;
  if (process.env.NODE_ENV !== "production") {
    return [...origines, "http://localhost:3000", "http://localhost:3001"];
  }
  return origines;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Les permissions sont vérifiées côté service (exigence du prompt maître §11) ;
  // cette validation globale ne couvre que la forme des requêtes entrantes.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // En-têtes de sécurité HTTP standards (X-Content-Type-Options,
  // X-Frame-Options, etc.) — absents jusqu'ici, aucun équivalent ailleurs
  // dans le code. `contentSecurityPolicy: false` : cette app est une API
  // JSON pure, jamais un rendu HTML — une CSP ici n'a pas de sens et
  // casserait les réponses de fichiers (PDF/Excel/Word) servies par
  // certaines routes (export, dossier-credit, rapport-annuel…).
  app.use(helmet({ contentSecurityPolicy: false }));

  const origines = originesAutorisees();
  app.enableCors({ origin: origines });
  new Logger("Bootstrap").log(`CORS restreint à : ${origines.join(", ")}`);

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`ELEGANZ API démarrée sur le port ${port}`);
}

bootstrap();
