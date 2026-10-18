import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ExpertsService } from "./experts.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { ShopMembershipGuard } from "../shops/shop-membership.guard";
import { ShopRoles } from "../shops/roles.decorator";
import { StaffRole, MenuAdmin } from "@eleganz/database";
import { requireAdminMenu } from "../admin-team/menu-admin.util";
import {
  AjouterDocumentExpertDto,
  AjouterReferenceExpertDto,
  CandidaterExpertDto,
  DefinirPhotoExpertDto,
  InviteExpertDto,
  ModererExpertDto,
  RequestExpertDocumentUploadDto,
  RequestExpertUploadDto,
  TEMPLATES_EXPERT,
} from "./dto/expert.dto";
import { ExpertProfileTemplate } from "@eleganz/database";

// Écran Experts (EXPERTS) — voir audit du 18 oct. 2026.
function requireAdmin(user: AuthenticatedUser) {
  requireAdminMenu(user, MenuAdmin.EXPERTS);
}

// Module EXPERTS (16 oct. 2026, point 2). Routes publiques (annuaire,
// profil, aperçu de lien) déclarées AVANT les routes privées pour éviter
// toute confusion d'ordre de résolution Nest — même précaution que
// marketplace-shops.controller.ts.
@Controller("experts")
export class ExpertsController {
  constructor(private readonly experts: ExpertsService) {}

  // --- Public (sans authentification) ---------------------------------

  @Get()
  rechercher(@Query("q") q?: string) {
    return this.experts.rechercher(q);
  }

  @Get("invitations/:token")
  apercuInvite(@Param("token") token: string) {
    return this.experts.apercuInvite(token);
  }

  @Get(":id")
  profilPublic(@Param("id") id: string) {
    return this.experts.profilPublic(id);
  }

  // --- Compte connecté (n'importe quel rôle) ---------------------------

  @Get("moi/profil")
  @UseGuards(JwtAuthGuard)
  monProfil(@CurrentUser() user: AuthenticatedUser) {
    return this.experts.monProfil(user.id);
  }

  @Post("moi/profil")
  @UseGuards(JwtAuthGuard)
  candidater(@CurrentUser() user: AuthenticatedUser, @Body() dto: CandidaterExpertDto) {
    return this.experts.candidater(user.id, dto);
  }

  // Gabarit de présentation du profil public — changement purement visuel,
  // ne repasse pas le profil en modération (voir ExpertsService.definirTemplate).
  @Patch("moi/template")
  @UseGuards(JwtAuthGuard)
  definirTemplate(@CurrentUser() user: AuthenticatedUser, @Body("template") template: string) {
    if (!TEMPLATES_EXPERT.includes(template as ExpertProfileTemplate)) {
      throw new BadRequestException("Gabarit inconnu.");
    }
    return this.experts.definirTemplate(user.id, template as ExpertProfileTemplate);
  }

  @Post("moi/photo/upload-url")
  @UseGuards(JwtAuthGuard)
  creerUrlUploadPhoto(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestExpertUploadDto) {
    return this.experts.creerUrlUploadPhoto(user.id, dto.contentType);
  }

  @Post("moi/photo")
  @UseGuards(JwtAuthGuard)
  definirPhoto(@CurrentUser() user: AuthenticatedUser, @Body() dto: DefinirPhotoExpertDto) {
    return this.experts.definirPhoto(user.id, dto.url);
  }

  // --- Pièces de la candidature : CV, diplômes, certifications, autres ---
  // (demande du 16 oct. 2026, point 3)

  @Post("moi/documents/upload-url")
  @UseGuards(JwtAuthGuard)
  creerUrlUploadDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestExpertDocumentUploadDto) {
    return this.experts.creerUrlUploadDocument(user.id, dto.contentType);
  }

  @Post("moi/documents")
  @UseGuards(JwtAuthGuard)
  ajouterDocument(@CurrentUser() user: AuthenticatedUser, @Body() dto: AjouterDocumentExpertDto) {
    return this.experts.ajouterDocument(user.id, dto);
  }

  @Delete("moi/documents/:documentId")
  @UseGuards(JwtAuthGuard)
  supprimerDocument(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.experts.supprimerDocument(user.id, documentId);
  }

  // Suggestion de contenu extraite du CV — "si cela est possible" (demande
  // du 16 oct. 2026, point 2) : best-effort, l'expert valide ou corrige.
  @Post("moi/documents/:documentId/extraire-cv")
  @UseGuards(JwtAuthGuard)
  extraireSuggestionCv(@CurrentUser() user: AuthenticatedUser, @Param("documentId") documentId: string) {
    return this.experts.extraireSuggestionCv(user.id, documentId);
  }

  // --- Personnes de référence (demande du 16 oct. 2026, point 3) ---------

  @Post("moi/references")
  @UseGuards(JwtAuthGuard)
  ajouterReference(@CurrentUser() user: AuthenticatedUser, @Body() dto: AjouterReferenceExpertDto) {
    return this.experts.ajouterReference(user.id, dto);
  }

  @Delete("moi/references/:referenceId")
  @UseGuards(JwtAuthGuard)
  supprimerReference(@CurrentUser() user: AuthenticatedUser, @Param("referenceId") referenceId: string) {
    return this.experts.supprimerReference(user.id, referenceId);
  }

  @Get("moi/engagements")
  @UseGuards(JwtAuthGuard)
  mesEngagements(@CurrentUser() user: AuthenticatedUser) {
    return this.experts.mesEngagements(user.id);
  }

  @Post("invitations/:token/accepter")
  @UseGuards(JwtAuthGuard)
  accepterInvite(@CurrentUser() user: AuthenticatedUser, @Param("token") token: string) {
    return this.experts.accepterInvite(token, user.id);
  }

  // --- Admin : modération de l'annuaire ---------------------------------

  @Get("admin/en-attente")
  @UseGuards(JwtAuthGuard)
  listerEnAttente(@CurrentUser() user: AuthenticatedUser) {
    requireAdmin(user);
    return this.experts.listerEnAttente();
  }

  @Patch("admin/:id/approuver")
  @UseGuards(JwtAuthGuard)
  approuver(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ModererExpertDto) {
    requireAdmin(user);
    return this.experts.approuver(id, user.id, dto.note);
  }

  @Patch("admin/:id/rejeter")
  @UseGuards(JwtAuthGuard)
  rejeter(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ModererExpertDto) {
    requireAdmin(user);
    return this.experts.rejeter(id, user.id, dto.note);
  }

  @Patch("admin/:id/suspendre")
  @UseGuards(JwtAuthGuard)
  suspendre(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: ModererExpertDto) {
    requireAdmin(user);
    return this.experts.suspendre(id, user.id, dto.note);
  }
}

// --- Boutique : inviter / lister / révoquer les accès experts -----------
//
// Déclaré dans un contrôleur distinct (préfixe shops/:shopId/experts) pour
// que ShopMembershipGuard s'applique via le même mécanisme que toutes les
// autres routes de gestion de boutique (lecture de :shopId dans l'URL).
@Controller("shops/:shopId/experts")
@UseGuards(JwtAuthGuard, ShopMembershipGuard)
export class ShopExpertsController {
  constructor(private readonly experts: ExpertsService) {}

  @Get()
  lister(@Param("shopId") shopId: string) {
    return this.experts.listEngagementsBoutique(shopId);
  }

  @Get("invitations")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  listerInvites(@Param("shopId") shopId: string) {
    return this.experts.listInvitesBoutique(shopId);
  }

  @Post("invitations")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  creerInvite(@CurrentUser() user: AuthenticatedUser, @Param("shopId") shopId: string, @Body() dto: InviteExpertDto) {
    return this.experts.creerInvite(shopId, user.id, dto);
  }

  @Delete("invitations/:inviteId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  revoquerInvite(@Param("shopId") shopId: string, @Param("inviteId") inviteId: string) {
    return this.experts.revoquerInvite(shopId, inviteId);
  }

  @Delete(":engagementId")
  @ShopRoles(StaffRole.OWNER, StaffRole.MANAGER)
  revoquerEngagement(@Param("shopId") shopId: string, @Param("engagementId") engagementId: string) {
    return this.experts.revoquerEngagement(shopId, engagementId);
  }
}
