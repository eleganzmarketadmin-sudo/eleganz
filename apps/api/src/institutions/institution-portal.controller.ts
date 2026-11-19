import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { InstitutionPortalService } from "./institution-portal.service";
import { InstitutionStaffService } from "./institution-staff.service";
import { DemandeCreditService } from "./demande-credit.service";
import { CreateLoanDecisionDto, RegisterInstitutionDto } from "./dto/institution.dto";
import { InviteInstitutionStaffDto } from "./dto/invite-institution-staff.dto";
import { UpdateInstitutionStaffDto } from "./dto/update-institution-staff.dto";
import { CreerDemandeCreditLibreDto } from "./dto/demande-credit.dto";
import { ValiderAnalyseCreditDto } from "./dto/analyse-credit.dto";
import { AnalyseCreditService } from "./analyse-credit.service";
import { RapportPortefeuilleService } from "./rapport-portefeuille.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { InstitutionMembershipGuard } from "./institution-membership.guard";
import { CurrentInstitutionId } from "./current-institution.decorator";
import { InstitutionRoles } from "./institution-roles.decorator";
import { InstitutionRole } from "@eleganz/database";
import { renderDossierCreditPdf } from "../finance/dossier-credit-pdf-renderer";
import { renderDemandeCreditPdf, type DemandeCreditPourPdf } from "./demande-credit-pdf-renderer";
import { renderRapportPortefeuillePdf } from "./rapport-portefeuille-pdf-renderer";
import { construireClasseurExcel } from "../common/xlsx.util";

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
    private readonly analyses: AnalyseCreditService,
    private readonly rapports: RapportPortefeuilleService,
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

  // Export PDF du dossier boutique (16 nov. 2026, demande du propriétaire :
  // "pour des raisons d'authenticité et de sécurité, porter les
  // informations d'identification du client et donner la possibilité de
  // les extraire ou imprimer en PDF" — jusqu'ici ce dossier n'était
  // consultable qu'à l'écran). `this.portal.dossier` revérifie l'accès
  // exactement comme la route ci-dessus (jamais une barrière réservée à
  // l'écran) ; `.financier` est déjà la forme exacte attendue par
  // renderDossierCreditPdf (même type DossierCreditBoutique que le dossier
  // crédit boutique côté Gestion, voir finance.controller.ts).
  @Get("shops/:shopId/dossier/export")
  @UseGuards(InstitutionMembershipGuard)
  async dossierExport(@CurrentInstitutionId() institutionId: string, @Param("shopId") shopId: string, @Res() res: Response) {
    const resultat = await this.portal.dossier(institutionId, shopId);
    const doc = renderDossierCreditPdf(resultat.financier);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="dossier-credit-${shopId}.pdf"`);
    return doc.pipe(res);
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

  // Rapport de portefeuille (écran RAPPORTS, 19 nov. 2026, demande du
  // propriétaire : "un menu dédié aux reports [...] utiles aux institutions
  // financières et capitales dans l'analyse crédit") — voir
  // RapportPortefeuilleService. Pas de restriction de rôle supplémentaire,
  // comme mesPrets/mesDecisions/mesBoutiques ci-dessus : un écran de
  // consultation, ouvert à tout membre actif de l'institution (le menu
  // RAPPORTS lui-même reste filtré côté profil/monMenu).
  @Get("rapports/portefeuille")
  @UseGuards(InstitutionMembershipGuard)
  rapportPortefeuille(@CurrentInstitutionId() institutionId: string) {
    return this.rapports.rapport(institutionId);
  }

  @Get("rapports/portefeuille/export")
  @UseGuards(InstitutionMembershipGuard)
  async rapportPortefeuilleExportPdf(@CurrentInstitutionId() institutionId: string, @CurrentUser() user: AuthenticatedUser, @Res() res: Response) {
    const [rapport, profil] = await Promise.all([this.rapports.rapport(institutionId), this.portal.monProfil(user.id)]);
    const doc = renderRapportPortefeuillePdf(rapport, profil.name);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="rapport-portefeuille-${institutionId}.pdf"`);
    return doc.pipe(res);
  }

  // Export Excel (16 nov. 2026, option retenue par le propriétaire :
  // "tableau de bord + export PDF/Excel") — réutilise le même utilitaire
  // partagé que les autres exports .xlsx de la plateforme
  // (common/xlsx.util.ts), jamais une librairie dédiée réinventée ici.
  @Get("rapports/portefeuille/export-excel")
  @UseGuards(InstitutionMembershipGuard)
  async rapportPortefeuilleExportExcel(@CurrentInstitutionId() institutionId: string, @Res() res: Response) {
    const rapport = await this.rapports.rapport(institutionId);
    const entetes = ["Classification", "Nombre de prêts", "Solde restant", "Provision requise"];
    const lignes = (["SAIN", "SOUS_SURVEILLANCE", "DOUTEUX", "COMPROMIS"] as const).map((cle) => {
      const ligne = rapport.ventilationRisque[cle];
      return [cle, ligne.nombre, ligne.soldeRestant, ligne.provisionRequise];
    });
    lignes.push([]);
    lignes.push(["Capital total en cours", rapport.capitalTotalEnCours]);
    lignes.push(["Provision requise totale", rapport.provisionRequiseTotal]);
    lignes.push(["Prêts actifs", rapport.nombrePretsActifs]);
    lignes.push(["Prêts clôturés", rapport.nombrePretsTermines]);
    lignes.push(["Taux de défaut (capital)", rapport.tauxDefautCapital]);
    lignes.push(["Taux de défaut (nombre de prêts)", rapport.tauxDefautNombre]);

    const buffer = await construireClasseurExcel("Rapport de portefeuille", entetes, lignes);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="rapport-portefeuille.xlsx"');
    res.send(buffer);
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

  // Export PDF de la candidature (16 nov. 2026, même demande que
  // dossierExport ci-dessus) — l'identification du demandeur (nom, raison
  // sociale, contacts) est TOUJOURS incluse dans le PDF, avec ou sans
  // dossier financier joint (voir demande-credit-pdf-renderer.ts : une
  // demande "libre", sans boutique ELEGANZ rattachée, n'a pas de
  // snapshotDossierCreditJson mais garde son identification complète).
  @Get("demandes/:numero/export")
  @UseGuards(InstitutionMembershipGuard)
  async detailDemandeExport(
    @CurrentInstitutionId() institutionId: string,
    @Param("numero") numero: string,
    @Res() res: Response,
  ) {
    const demande = await this.demandes.detail(institutionId, numero);
    const doc = renderDemandeCreditPdf(demande as unknown as DemandeCreditPourPdf);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="demande-credit-${numero}.pdf"`);
    return doc.pipe(res);
  }

  // Exposition de l'institution liée à cette candidature (chantier "menu
  // Rapports", 19 nov. 2026, volet "capitales dans l'analyse crédit") —
  // voir RapportPortefeuilleService.expositionPourDemande : vient en
  // complément de l'analyse de crédit automatisée ci-dessous (score propre
  // à la boutique), jamais à l'intérieur de son calcul.
  @Get("demandes/:numero/exposition")
  @UseGuards(InstitutionMembershipGuard)
  exposition(@CurrentInstitutionId() institutionId: string, @Param("numero") numero: string) {
    return this.rapports.expositionPourDemande(institutionId, numero);
  }

  // Analyse de crédit automatisée (chantier "gestion de risque autonome", 16
  // nov. 2026) — voir AnalyseCreditService pour le calcul et le double
  // contrôle réel appliqué dans InstitutionPortalService.decider.
  // "Lancer/relancer l'analyse" reste réservé aux rôles qui en ont
  // l'écran ANALYSE par défaut (ADMINISTRATEUR/GESTIONNAIRE_COMPTE/
  // ANALYSTE_CREDIT) — CHARGE_CLIENTELE, qui reçoit les candidatures, n'a
  // pas vocation à déclencher lui-même le calcul du score.
  @Post("demandes/:numero/analyse")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE, InstitutionRole.ANALYSTE_CREDIT)
  genererAnalyse(@CurrentInstitutionId() institutionId: string, @Param("numero") numero: string) {
    return this.analyses.genererAnalyse(institutionId, numero);
  }

  @Get("demandes/:numero/analyse")
  @UseGuards(InstitutionMembershipGuard)
  obtenirAnalyse(@CurrentInstitutionId() institutionId: string, @Param("numero") numero: string) {
    return this.analyses.obtenirAnalyse(institutionId, numero);
  }

  // Validation/rejet par un analyste — pas de restriction de rôle plus
  // stricte ici que sur genererAnalyse ci-dessus : la VRAIE barrière contre
  // un double rôle analyste+décideur est posée dans
  // InstitutionPortalService.decider (comparaison des deux userId), jamais
  // seulement une restriction de rôle sur cette route, qui serait
  // contournable par une institution à équipe réduite où une même personne
  // cumule plusieurs rôles.
  @Post("analyses/:id/valider")
  @UseGuards(InstitutionMembershipGuard)
  @InstitutionRoles(InstitutionRole.ADMINISTRATEUR, InstitutionRole.GESTIONNAIRE_COMPTE, InstitutionRole.ANALYSTE_CREDIT)
  validerAnalyse(
    @CurrentInstitutionId() institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ValiderAnalyseCreditDto,
  ) {
    return this.analyses.validerAnalyse(institutionId, id, user.id, dto.decision, dto.note);
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
  inviteStaff(
    @CurrentInstitutionId() institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteInstitutionStaffDto,
  ) {
    return this.staff.inviteStaff(institutionId, dto, user.id);
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
  removeStaff(
    @CurrentInstitutionId() institutionId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param("staffId") staffId: string,
  ) {
    return this.staff.deactivateStaff(institutionId, staffId, user.id);
  }
}
