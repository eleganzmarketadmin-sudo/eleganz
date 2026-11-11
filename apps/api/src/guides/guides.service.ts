import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { UpsertGuideDto } from "./dto/upsert-guide.dto";
import { SEED_ARTICLES } from "./seed-articles";

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
export class GuidesService implements OnModuleInit {
  private readonly logger = new Logger(GuidesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Amorçage du Centre d'aide (10 nov. 2026) : insère le contenu de
   * départ (seed-articles.ts) au démarrage de l'API, sans avoir besoin
   * d'un compte admin ni d'un accès direct à la base de production.
   * `skipDuplicates` s'appuie sur l'unicité de `slug` — une fiche déjà
   * présente (créée ici à un déploiement précédent, ou depuis modifiée
   * par un agent) n'est jamais recréée ni écrasée. Ne bloque jamais le
   * démarrage de l'API si ça échoue (ex. table pas encore migrée au tout
   * premier déploiement) : seule une erreur est journalisée.
   */
  async onModuleInit() {
    try {
      const resultat = await this.prisma.guideArticle.createMany({
        data: SEED_ARTICLES,
        skipDuplicates: true,
      });
      if (resultat.count > 0) {
        this.logger.log(`Centre d'aide : ${resultat.count} fiche(s) de départ ajoutée(s).`);
      }
    } catch (err) {
      this.logger.error("Centre d'aide : échec de l'amorçage du contenu de départ.", err as Error);
    }
  }

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
        visibleFaq: dto.visibleFaq ?? false,
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
        visibleFaq: dto.visibleFaq ?? false,
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

  /**
   * FAQ publique de la plateforme (demande du 11 nov. 2026) — accessible à
   * tout visiteur sans authentification, sur `/aide`. Ne renvoie que les
   * fiches explicitement marquées `visibleFaq` par un agent ELEGANZ ET
   * ayant un `contenuClient` renseigné (une fiche cochée par erreur sans
   * texte client n'apparaît jamais vide côté public) ; jamais
   * `contenuAgent`, `motsCles` ni `imagesAgent`, même indirectement.
   */
  async listerFaq() {
    const fiches = await this.prisma.guideArticle.findMany({
      where: { visibleFaq: true, contenuClient: { not: null } },
      select: { titre: true, categorie: true, contenuClient: true, imagesClient: true },
      orderBy: [{ categorie: "asc" }, { titre: "asc" }],
    });
    // Double sécurité : exclut aussi un contenuClient vide ("") qui
    // passerait le filtre Prisma `not: null` mais n'aurait rien à montrer.
    return fiches.filter((f) => f.contenuClient && f.contenuClient.trim().length > 0);
  }
}
