import { Controller, Get, Param } from "@nestjs/common";
import { GuidesService } from "./guides.service";

// Pas de guard : lien transmis par un agent ELEGANZ à un client, qui n'a
// pas de compte à ouvrir pour le lire — même principe que
// marketplace-catalog.controller.ts. Ne jamais exposer contenuAgent ici :
// c'est GuidesService.obtenirPartagePublic qui filtre, pas ce contrôleur.
@Controller("guides/public")
export class GuidesPublicController {
  constructor(private readonly guides: GuidesService) {}

  @Get(":publicSlug")
  obtenir(@Param("publicSlug") publicSlug: string) {
    return this.guides.obtenirPartagePublic(publicSlug);
  }
}

// FAQ publique de la plateforme (11 nov. 2026, page `/aide` côté front) —
// chemin séparé de `guides/public/:publicSlug` plutôt qu'un sous-chemin
// littéral du même contrôleur : Nest résout les routes d'un contrôleur dans
// leur ordre de déclaration, et un `@Get(":publicSlug")` déclaré avant
// aurait capturé `/guides/public/faq` comme `publicSlug="faq"` avant
// d'atteindre une route littérale placée après. Un contrôleur dédié évite
// d'avoir à dépendre de cet ordre de déclaration.
@Controller("guides/public-faq")
export class GuidesPublicFaqController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  lister() {
    return this.guides.listerFaq();
  }
}
