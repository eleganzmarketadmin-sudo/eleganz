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
