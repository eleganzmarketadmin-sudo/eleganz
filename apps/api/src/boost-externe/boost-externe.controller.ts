import { Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { BoostExterneService } from "./boost-externe.service";
import { CreateCampagneExterneDto } from "./dto/create-campagne-externe.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, BoostCanal, MenuAdmin } from "@eleganz/database";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

const SITE_PUBLIC_BASE_URL = process.env.SITE_PUBLIC_BASE_URL || "https://www.eleganzmarket.com";

/**
 * ELEGANZ BOOST 360° (27 nov. 2026) — mêmes gardes que BoostController :
 * OWNER/MANAGER consultent, seul OWNER engage une dépense (connexion d'un
 * compte publicitaire, lancement d'une campagne). La route de callback
 * OAuth est volontairement PUBLIQUE (sans JwtAuthGuard) : c'est le réseau
 * publicitaire externe qui y redirige le navigateur de la boutique, sans
 * en-tête d'authentification ELEGANZ — la sécurité tient au `state` signé
 * (voir oauth-state.util.ts), jamais à un JwtAuthGuard ici.
 */
@Controller()
export class BoostExterneController {
  constructor(private readonly boostExterne: BoostExterneService) {}

  // --- Connexion OAuth ---

  @Post("shops/:shopId/boost-externe/connexions/:canal/demarrer")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  demarrerConnexion(@Param("shopId") shopId: string, @Param("canal") canal: BoostCanal) {
    return this.boostExterne.demarrerConnexion(shopId, canal);
  }

  @Get("boost-externe/oauth/callback/:canal")
  async callbackOAuth(
    @Param("canal") canal: BoostCanal,
    @Query("code") code: string,
    @Query("state") state: string,
    @Query("error") erreurReseau: string | undefined,
    @Res() res: Response,
  ) {
    if (erreurReseau || !code || !state) {
      res.redirect(`${SITE_PUBLIC_BASE_URL}/boost-360?connexion=refusee&canal=${canal}`);
      return;
    }
    try {
      await this.boostExterne.traiterCallbackOAuth(canal, code, state);
      res.redirect(`${SITE_PUBLIC_BASE_URL}/boost-360?connexion=reussie&canal=${canal}`);
    } catch {
      res.redirect(`${SITE_PUBLIC_BASE_URL}/boost-360?connexion=echec&canal=${canal}`);
    }
  }

  @Delete("shops/:shopId/boost-externe/connexions/:canal")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  deconnecter(@Param("shopId") shopId: string, @Param("canal") canal: BoostCanal) {
    return this.boostExterne.deconnecter(shopId, canal);
  }

  @Get("shops/:shopId/boost-externe/connexions")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  mesConnexions(@Param("shopId") shopId: string) {
    return this.boostExterne.mesConnexions(shopId);
  }

  // --- Campagnes ---

  @Get("shops/:shopId/boost-externe/campagnes")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  mesGroupes(@Param("shopId") shopId: string) {
    return this.boostExterne.mesGroupes(shopId);
  }

  @Post("shops/:shopId/boost-externe/campagnes")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  creerGroupe(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body() dto: CreateCampagneExterneDto,
  ) {
    return this.boostExterne.creerGroupe(shopId, user.id, dto);
  }

  @Delete("shops/:shopId/boost-externe/campagnes/:groupeId")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER)
  annulerGroupe(@Param("shopId") shopId: string, @Param("groupeId") groupeId: string) {
    return this.boostExterne.annulerGroupe(shopId, groupeId);
  }

  @Post("shops/:shopId/boost-externe/campagnes/unitaire/:campagneId/pause")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  mettreEnPause(@Param("shopId") shopId: string, @Param("campagneId") campagneId: string) {
    return this.boostExterne.mettreEnPause(shopId, campagneId);
  }

  @Post("shops/:shopId/boost-externe/campagnes/unitaire/:campagneId/reprendre")
  @UseGuards(JwtAuthGuard, ShopMembershipGuard)
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  reprendre(@Param("shopId") shopId: string, @Param("campagneId") campagneId: string) {
    return this.boostExterne.reprendre(shopId, campagneId);
  }

  // --- Centre de pilotage (supervision transversale) ---

  @Get("admin/boost-externe/campagnes")
  @UseGuards(JwtAuthGuard)
  listerToutes(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostExterne.listerToutesLesCampagnes();
  }

  // Déclenchement manuel de la synchronisation, même convention que les
  // autres étapes de cycle (admin/billing/run-*) — en attendant le prochain
  // passage du cron.
  @Post("admin/boost-externe/synchroniser-maintenant")
  @UseGuards(JwtAuthGuard)
  synchroniserMaintenant(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.BOOST);
    return this.boostExterne.synchroniserStatutsEtStatistiques();
  }
}
