import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { MenuAdmin } from "@eleganz/database";
import { GuidesService } from "./guides.service";
import { UpsertGuideDto } from "./dto/upsert-guide.dto";
import { RequestGuideImageUploadDto } from "./dto/request-guide-image-upload.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";
import { requireAdminMenu } from "../admin-team/menu-admin.util";

// Centre d'aide interne ELEGANZ (10 nov. 2026) — réservé à
// MenuAdmin.CENTRE_AIDE, accordé par défaut à tous les rôles ADMIN_* (voir
// menu-admin.util.ts). Le volet public (lecture seule, sans auth, limité
// au contenu client d'une fiche partagée) est dans guides-public.controller.ts.
@Controller("admin/guides")
@UseGuards(JwtAuthGuard)
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  rechercher(@CurrentUser() user: AuthenticatedUser, @Query("q") q?: string, @Query("categorie") categorie?: string) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.rechercher({ q, categorie });
  }

  @Get("categories")
  listerCategories(@CurrentUser() user: AuthenticatedUser) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.listerCategories();
  }

  @Get(":id")
  obtenir(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.obtenir(id);
  }

  @Post()
  creer(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertGuideDto) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.creer(dto, user.id);
  }

  @Patch(":id")
  modifier(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpsertGuideDto) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.modifier(id, dto);
  }

  @Delete(":id")
  supprimer(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.supprimer(id);
  }

  @Post("upload-url")
  creerUrlUploadImage(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestGuideImageUploadDto) {
    requireAdminMenu(user, MenuAdmin.CENTRE_AIDE);
    return this.guides.creerUrlUploadImage(dto.contentType);
  }
}
