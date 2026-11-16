import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { InstitutionPortalService } from "./institution-portal.service";
import { InstitutionStaffService } from "./institution-staff.service";
import { DemandeCreditService } from "./demande-credit.service";
import { CreateLoanDecisionDto, RegisterInstitutionDto } from "./dto/institution.dto";
import { InviteInstitutionStaffDto } from "./dto/invite-institution-staff.dto";
import { UpdateInstitutionStaffDto } from "./dto/update-institution-staff.dto";
import { CreerDemandeCreditLibreDto } from "./dto/demande-credit.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { InstitutionMembershipGuard } from "./institution-membership.guard";
import { CurrentInstitutionId } from "./current-institution.decorator";
import { InstitutionRoles } from "./institution-roles.decorator";
import { InstitutionRole } from "@eleganz/database";

// /me et /inscription restent volontairement hors InstitutionMembershipGuard
// (14 nov. 2026, inchangé) : une institution doit pouvoir consulter son
// propre statut et s'inscrire sans déjà être active/pourvue d'une équipe.
// Toute autre route exige depuis le 16 nov. 2026 InstitutionMembershipGuard,
// qui résout l'institution depuis le JWT (voir le commentaire sur ce
// guard) et remplace la répétition manuelle
// `monProfil(user.id) + exigerInstitutionActive(moi)` qui existait ici
// avant cette date.
@Controller("institution-portal")
@UseGuards(JwtAuthGuard)
export class InstitutionPortalController {
  constructor(
    private readonly portal: InstitutionPortalService,
    private readonly staff: InstitutionStaffService,
    private readonly demandes: DemandeCreditService,
  ) {}

  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.portal.monProfil(user.id);
  }

  // Auto-inscription (14 nov. 2026) — voir InstitutionPortalService.inscrire.
  // Le compte ELEGANZ (role=INSTITUTION_STAFF) vient d'être créé par
  // /auth/register juste avant cet appel, avec le jeton déjà en main.
  @Post("inscription")
  async inscription(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterInstitutionDto) {
    return this.portal.inscrire(user.id, dto);
  }

  @Get("shops")
  @UseGuards(InstitutionMembershipGuard)
  async mesBoutiques(@CurrentInstitutionId() institutionId: string) {
    return this.portal.mesBoutiques(institutionId);
  }

  @Get("shops/:shopId/dossier")
  @UseGuards(InstitutionMembershipGuard)
  async dossier(@CurrentInstitutionId() institutionId: string, @Param("shopId") shopId: string) {
    return this.portal.dossier(institutionId, shopId);
  }

  @Post("shops/:shopId/decisions")
  @UseGuards(InstitutionMembershipGuard)
  async decider(
    @CurrentInstitutionId() institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("shopId") shopId: string,
    @Body() dto: CreateLoanDecisionDto,
  ) {
    return this.portal.decider(institutionId, shopId, user.id, dto);
  }

  @Get("decisions")
  @UseGuards(InstitutionMembershipGuard)
  async mesDecisions(@CurrentInstitutionId() institutionId: string) {
    return this.portal.mesDecisions(institutionId);
  }

  @Get("loans")
  @UseGuards(InstitutionMembershipGuard)
  async mesPrets(@CurrentInstitutionId() institutionId: string) {
    return this.portal.mesPrets(institutionId);
  }

  @Post("shops/:shopId/loans/:loanId/echeances")
  @UseGuards(InstitutionMembershipGuard)
  async comptabiliserEcheance(
    @CurrentInstitutionId() institutionId: string,
    @Param("shopId") shopId: string,
    @Param("loanId") loanId: string,
    @Query("periode") periode?: string,
  ) {
    return this.portal.comptabiliserEcheance(institutionId, shopId, loanId, periode);
  }

  @Get("shops/:shopId/loans/:loanId/echeances")
  @UseGuards(InstitutionMembershipGuard)
  async listerEcheances(
    @CurrentInstitutionId() institutionId: string,
    @Param("shopId") shopId: string,
    @Param("loanId") loanId: string,
  ) {
    return this.portal.listerEcheances(institutionId, shopId, loanId);
  }

  // Candidatures de crédit numérotées (16 nov. 2026, demande du
  // propriétaire, point 1) — GET/:numero restent ouverts à tout membre actif
  // (consultation), la création libre est réservée aux rôles en contact
  // avec le demandeur.
  @Get("demandes")
  @UseGuards(InstitutionMembershipGuard)
  mesDemandes(@CurrentInstitutionId() institutionId: string) {
    return this.demandes.lister(institutionId);
  }

  @Get("demandes/:numero")
  @UseGuards(InstitutionMembershipGuard)
  detailDemande(@CurrentInstitutionId() institutionId: string, @Param("numero") numero: string) {
    return this.demandes.detail(institutionId, numero);
  }

  @Post("demandes")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE, InstitutionRole.CHARGE_CLIENTELE)
  creerDemandeLibre(
    @CurrentInstitutionId() institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreerDemandeCreditLibreDto,
  ) {
    return this.demandes.creerLibre(institutionId, user.id, dto);
  }

  // Équipe institution (16 nov. 2026, demande du propriétaire, point 2) —
  // mirroring les routes staff de ShopsController, réservées à
  // ADMINISTRATEUR/GESTIONNAIRE_COMPTE (même paire de rôles qu'OWNER/MANAGER
  // côté Gestion).
  @Get("staff")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE)
  listStaff(@CurrentInstitutionId() institutionId: string) {
    return this.staff.listStaff(institutionId);
  }

  @Post("staff")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE)
  inviteStaff(@CurrentInstitutionId() institutionId: string, @Body() dto: InviteInstitutionStaffDto) {
    return this.staff.inviteStaff(institutionId, dto);
  }

  @Patch("staff/:staffId")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE)
  updateStaff(
    @CurrentInstitutionId() institutionId: string,
    @Param("staffId") staffId: string,
    @Body() dto: UpdateInstitutionStaffDto,
  ) {
    return this.staff.updateStaff(institutionId, staffId, dto);
  }

  @Delete("staff/:staffId")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE)
  removeStaff(@CurrentInstitutionId() institutionId: string, @Param("staffId") staffId: string) {
    return this.staff.deactivateStaff(institutionId, staffId);
  }
}
