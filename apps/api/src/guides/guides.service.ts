import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { UpsertGuideDto } from "./dto/upsert-guide.dto";

// Même slugification que shops.service.ts — garde la convention du
// dépôt plutôt que d'en réinventer une.
function slugify(texte: string): string {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

@Injectable()
export class GuidesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Recherche texte simple (titre, catégorie, mots-clés, contenu agent)
   * par ILIKE Postgres — largement suffisant au volume attendu (quelques
   * dizaines/centaines de fiches), pas besoin d'un moteur de recherche
   * externe pour ça. Le contenu client n'est pas inclus dans la recherche
   * agent : s'il faut le retrouver, il est presque toujours question du
   * même sujet que contenuAgent, déjà couvert.
   */
  async rechercher(params: { q?: string; categorie?: string }) {
    const { q, categorie } = params;
    return this.prisma.guideArticle.findMany({
      where: {
        ...(categorie ? { categorie } : {}),
        ...(q
          ? {
              OR: [
                { titre: { contains: q, mode: "insensitive" } },
                { contenuAgent: { contains: q, mode: "insensitive" } },
                { motsCles: { has: q.toLowerCase() } },
              ],
            }
          : {}),
      },
      orderBy: { titre: "asc" },
    });
  }

  async listerCategories() {
    const lignes = await this.prisma.guideArticle.findMany({
      select: { categorie: true },
      distinct: ["categorie"],
      orderBy: { categorie: "asc" },
    });
    return lignes.map((l) => l.categorie);
  }

  async obtenir(id: string) {
    const fiche = await this.prisma.guideArticle.findUnique({ where: { id } });
    if (!fiche) throw new NotFoundException("Fiche introuvable.");
    return fiche;
  }

  async creer(dto: UpsertGuideDto, creeParId: string) {
    const base = slugify(dto.titre);
    const slug = base ? `${base}-${randomUUID().slice(0, 6)}` : randomUUID();
    return this.prisma.guideArticle.create({
      data: {
        slug,
        titre: dto.titre,
        categorie: dto.categorie,
        motsCles: (dto.motsCles ?? []).map((m) => m.toLowerCase()),
        contenuAgent: dto.contenuAgent,
        imagesAgent: dto.imagesAgent ?? [],
        contenuClient: dto.contenuClient,
        imagesClient: dto.imagesClient ?? [],
        partagePublicActif: dto.partagePublicActif ?? false,
        publicSlug: dto.partagePublicActif ? randomUUID() : null,
        creeParId,
      },
    });
  }

  async modifier(id: string, dto: UpsertGuideDto) {
    const existant = await this.obtenir(id);

    // Activer le partage public pour la première fois génère un lien ;
    // le désactiver conserve le publicSlug (si réactivé plus tard, le
    // même lien déjà transmis à un client refonctionne) — seule la
    // visibilité change, jamais le slug.
    const publicSlug = dto.partagePublicActif && !existant.publicSlug ? randomUUID() : existant.publicSlug;

    return this.prisma.guideArticle.update({
      where: { id },
      data: {
        titre: dto.titre,
        categorie: dto.categorie,
        motsCles: (dto.motsCles ?? []).map((m) => m.toLowerCase()),
        contenuAgent: dto.contenuAgent,
        imagesAgent: dto.imagesAgent ?? [],
        contenuClient: dto.contenuClient,
        imagesClient: dto.imagesClient ?? [],
        partagePublicActif: dto.partagePublicActif ?? false,
        publicSlug,
      },
    });
  }

  async supprimer(id: string) {
    await this.obtenir(id);
    await this.prisma.guideArticle.delete({ where: { id } });
    return { ok: true };
  }

  async creerUrlUploadImage(contentType: string) {
    return this.storage.creerUrlUpload("guides/images", contentType);
  }

  /**
   * Lecture publique (aucune authentification) — ne renvoie QUE le
   * contenu "client" : jamais contenuAgent, jamais motsCles/categorie
   * internes. 404 si le lien n'existe pas ou a été désactivé, sans
   * distinguer les deux cas (ne pas révéler qu'une fiche a existé).
   */
  async obtenirPartagePublic(publicSlug: string) {
    const fiche = await this.prisma.guideArticle.findFirst({
      where: { publicSlug, partagePublicActif: true },
    });
    if (!fiche) throw new NotFoundException("Guide introuvable.");
    if (!fiche.contenuClient) {
      throw new BadRequestException("Cette fiche n'a pas de contenu client à partager.");
    }
    return {
      titre: fiche.titre,
      contenuClient: fiche.contenuClient,
      imagesClient: fiche.imagesClient,
    };
  }
}
