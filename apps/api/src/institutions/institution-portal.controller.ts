import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { InstitutionPortalService } from "./institution-portal.service";
import { CreateLoanDecisionDto } from "./dto/institution.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

// Pas de garde de rôle dédiée : comme DeliveryController.me pour les
// livreurs, l'accès est naturellement limité par la résolution du profil
// (InstitutionPortalService.monProfil lève NotFoundException si ce compte
// n'a pas de profil Institution) plutôt que par une classe de garde
// séparée — même principe que le reste de l'API (JwtAuthGuard relit
// toujours le rôle en base, voir jwt-auth.guard.ts).
@Controller("institution-portal")
@UseGuards(JwtAuthGuard)
export class InstitutionPortalController {
  constructor(private readonly portal: InstitutionPortalService) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.monProfil(user.id);
  }

  @Get("shops")
  async mesBoutiques(@CurrentUser() user: AuthenticatedUser) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.mesBoutiques(moi.id);
  }

  @Get("shops/:shopId/dossier")
  async dossier(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.dossier(moi.id, shopId);
  }

  @Post("shops/:shopId/decisions")
  async decider(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body() dto: CreateLoanDecisionDto,
  ) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.decider(moi.id, shopId, user.id, dto);
  }

  @Get("decisions")
  async mesDecisions(@CurrentUser() user: AuthenticatedUser) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.mesDecisions(moi.id);
  }

  @Get("loans")
  async mesPrets(@CurrentUser() user: AuthenticatedUser) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.mesPrets(moi.id);
  }

  @Post("shops/:shopId/loans/:loanId/echeances")
  async comptabiliserEcheance(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Param("loanId") loanId: string,
    @Query("periode") periode?: string,
  ) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.comptabiliserEcheance(moi.id, shopId, loanId, periode);
  }

  @Get("shops/:shopId/loans/:loanId/echeances")
  async listerEcheances(
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Param("loanId") loanId: string,
  ) {
    const moi = await this.portal.monProfil(user.id);
    return this.portal.listerEcheances(moi.id, shopId, loanId);
  }
}
