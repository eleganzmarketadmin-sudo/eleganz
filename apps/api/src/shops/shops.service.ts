import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateShopDto } from "./dto/create-shop.dto";
import { InviteStaffDto } from "./dto/invite-staff.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { UpdateInvoiceSettingsDto } from "./dto/update-invoice-settings.dto";
import { CreateShopDriverDto, UpdateShopDriverDto } from "./dto/shop-driver.dto";
import { AddDeliveryZoneDto } from "./dto/add-delivery-zone.dto";
import { MenuGestion, PlanCategory, ShopStatus, StaffRole } from "@eleganz/database";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const TOUS_LES_ECRANS_GESTION: MenuGestion[] = Object.values(MenuGestion);

/**
 * Écrans de menu accordés à un rôle par défaut, tant que le profil n'a pas
 * reçu de choix explicite (16 oct. 2026, point 2 des propositions du 16
 * oct. 2026 — "le rôle accordé aux équipes ne restreint pas le menu").
 * Équipe et Paramètres restent réservés à OWNER/MANAGER par défaut, comme
 * demandé ; le propriétaire ou le gérant peut toujours ajuster au cas par
 * cas via PATCH :shopId/staff/:staffId.
 */
function menuGestionParDefaut(role: StaffRole): MenuGestion[] {
  switch (role) {
    case StaffRole.OWNER:
    case StaffRole.MANAGER:
      return TOUS_LES_ECRANS_GESTION;
    case StaffRole.CASHIER:
      return [MenuGestion.CAISSE, MenuGestion.TABLEAU_DE_BORD];
    case StaffRole.STOCK_KEEPER:
      return [MenuGestion.CATALOGUE, MenuGestion.COMMANDES, MenuGestion.LIVREURS];
    case StaffRole.SALES_LEAD:
      return [
        MenuGestion.CAISSE,
        MenuGestion.TABLEAU_DE_BORD,
        MenuGestion.CATALOGUE,
        MenuGestion.COMMANDES,
        MenuGestion.LITIGES,
        MenuGestion.MESSAGERIE,
      ];
    case StaffRole.ACCOUNTANT:
      return [MenuGestion.FINANCE, MenuGestion.FACTURES, MenuGestion.RELEVES];
    case StaffRole.EXTERNAL_ACCOUNTANT:
      // Déjà restreint en lecture seule à Finance & Comptabilité par
      // ShopMembershipGuard (docs/ARCHITECTURE_FINANCE.md §8sexies) — on
      // garde le menu cohérent avec cette barrière existante.
      return [MenuGestion.FINANCE];
    default:
      return [];
  }
}

// Tableau vide sur la ligne (valeur de départ, ou remise à zéro explicite
// via PATCH) = pas de choix explicite → liste par défaut du rôle ; sinon le
// choix du propriétaire/gérant fait foi tel quel, même s'il réduit le rôle
// en-dessous de son propre défaut.
function ecransEffectifs(staff: { role: StaffRole; menuItemsOverride: MenuGestion[] }): MenuGestion[] {
  return staff.menuItemsOverride.length > 0 ? staff.menuItemsOverride : menuGestionParDefaut(staff.role);
}

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Un compte = une boutique (18 oct. 2026, demande explicite "éviter des
   * multiples créations pour éviter les paiements"). Email et téléphone
   * sont déjà uniques par compte (User.email/phone, contrainte en base) —
   * ce correctif ferme la vraie faille : rien n'empêchait jusqu'ici le
   * MÊME compte déjà propriétaire d'une boutique (même suspendue pour
   * impayé, même fermée) de créer une nouvelle boutique et de repartir
   * avec un essai gratuit neuf. Comptage sur TOUTE boutique dont ce compte
   * est propriétaire, quel que soit son statut (FREE_PERIOD, SUSPENDED,
   * CLOSED...) — volontairement sans exception : l'énoncé de la demande
   * ("un compte ne peut posséder plus d'une boutique") ne distingue pas
   * une fermeture propre d'une suspension.
   */
  async create(ownerId: string, dto: CreateShopDto) {
    const boutiqueExistante = await this.prisma.shop.count({ where: { ownerId } });
    if (boutiqueExistante > 0) {
      throw new ConflictException(
        "Ce compte possède déjà une boutique. Un compte ne peut posséder qu'une seule boutique sur ELEGANZ.",
      );
    }

    const baseSlug = slugify(dto.name);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

    // Bouquet Gestion par défaut à la création (14 oct. 2026, plan
    // commercial) : la boutique démarre sur le bouquet le moins cher
    // (Starter) — elle peut en changer plus tard depuis /admin/boutiques.
    // `undefined` plutôt qu'une erreur si aucun bouquet n'existe encore
    // (ex. tout premier démarrage avant que le seed n'ait tourné).
    const bouquetDeDepart = await this.prisma.subscriptionPlan.findFirst({
      where: { category: PlanCategory.GESTION, active: true },
      orderBy: { monthlyPrice: "asc" },
      select: { id: true },
    });

    // Décision #3 : période gratuite par défaut 3 mois, démarrée à la création
    // (« l'entrée en relation »), mais modifiable ensuite depuis l'admin.
    const shop = await this.prisma.shop.create({
      data: {
        ownerId,
        name: dto.name,
        slug,
        mode: dto.mode,
        status: ShopStatus.FREE_PERIOD,
        freeTrialStartedAt: new Date(),
        freeTrialDurationDays: 90,
        openingFeeWaived: true,
        gestionBouquetId: bouquetDeDepart?.id,
        staff: {
          create: {
            userId: ownerId,
            role: StaffRole.OWNER,
          },
        },
      },
    });

    return shop;
  }

  /**
   * Boutiques accessibles à l'utilisateur : celles qu'il possède, mais aussi
   * celles où il est simplement membre de l'équipe (caissier, gérant, ...) —
   * un caissier n'est jamais propriétaire mais doit voir la boutique où il
   * travaille pour ouvrir la caisse.
   */
  async findMine(userId: string) {
    const boutiques = await this.prisma.shop.findMany({
      where: {
        OR: [{ ownerId: userId }, { staff: { some: { userId, active: true } } }],
      },
      orderBy: { createdAt: "desc" },
      include: { staff: { where: { userId }, select: { role: true, menuItemsOverride: true } } },
    });
    // `myRole` permet au front de masquer la navigation hors Finance &
    // Comptabilité pour un StaffRole.EXTERNAL_ACCOUNTANT (voir
    // docs/ARCHITECTURE_FINANCE.md §8sexies) — la vraie barrière reste
    // ShopMembershipGuard côté API, ceci n'est qu'un confort de navigation.
    // `menuItems` (16 oct. 2026, point 2 des propositions du 16 oct. 2026)
    // généralise ce confort de navigation : la liste effective des écrans
    // accordés à CE membre pour CETTE boutique, calculée par
    // ecransEffectifs — GestionShell filtre son menu avec, au lieu du seul
    // cas particulier EXTERNAL_ACCOUNTANT d'avant.
    return boutiques.map(({ staff, ...boutique }) => {
      const monRole = boutique.ownerId === userId ? StaffRole.OWNER : staff[0]?.role;
      return {
        ...boutique,
        myRole: monRole ?? null,
        menuItems: monRole
          ? ecransEffectifs({ role: monRole, menuItemsOverride: staff[0]?.menuItemsOverride ?? [] })
          : [],
      };
    });
  }

  async findOne(shopId: string) {
    return this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
  }

  /**
   * Identité affichée sur les documents imprimés de la boutique — chaque
   * vendeur personnalise ses propres factures/tickets/bons de livraison
   * avec ses informations (prompt du 12 oct. 2026). Un champ envoyé comme
   * chaîne vide efface l'information plutôt que de la laisser inchangée.
   */
  async updateInvoiceSettings(shopId: string, dto: UpdateInvoiceSettingsDto) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({
      where: { id: shopId },
      data: {
        ...(dto.invoiceAddress !== undefined && { invoiceAddress: dto.invoiceAddress || null }),
        ...(dto.invoicePhone !== undefined && { invoicePhone: dto.invoicePhone || null }),
        ...(dto.invoiceLogoUrl !== undefined && { invoiceLogoUrl: dto.invoiceLogoUrl || null }),
        ...(dto.invoiceFooterNote !== undefined && {
          invoiceFooterNote: dto.invoiceFooterNote || null,
        }),
      },
    });
  }

  /**
   * Invite un collaborateur déjà inscrit sur ELEGANZ dans l'équipe de la
   * boutique (prompt §10 : propriétaire, gérant, caissier, magasinier,
   * responsable commercial, comptable). Chaque journal de caisse / audit
   * s'appuie ensuite sur ShopStaff.role pour savoir qui a fait quoi.
   *
   * Deux limites viennent du bouquet Gestion de la boutique (14 oct. 2026,
   * plan commercial, `SubscriptionPlan.featuresJson`) : la taille maximale
   * de l'équipe (`maxEquipe`, `null` = illimité) et l'accès au rôle
   * Comptable externe (`comptableExterne`, réservé au bouquet Premium).
   */
  async inviteStaff(shopId: string, dto: InviteStaffDto) {
    const boutique = await this.prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: { gestionBouquet: { select: { name: true, featuresJson: true } } },
    });
    const features = (boutique.gestionBouquet?.featuresJson as unknown as Record<string, unknown> | undefined) ?? {};

    if (dto.role === StaffRole.EXTERNAL_ACCOUNTANT && features.comptableExterne !== true) {
      throw new ConflictException(
        `L'invitation d'un comptable externe n'est pas incluse dans le bouquet ${boutique.gestionBouquet?.name ?? "actuel"} de cette boutique. Passez au bouquet Premium depuis le Centre de pilotage pour l'activer.`,
      );
    }

    const maxEquipe = features.maxEquipe;
    if (typeof maxEquipe === "number") {
      const effectifActuel = await this.prisma.shopStaff.count({
        where: { shopId, active: true, role: { not: StaffRole.OWNER } },
      });
      if (effectifActuel >= maxEquipe) {
        throw new ConflictException(
          `Le bouquet ${boutique.gestionBouquet?.name ?? "actuel"} de cette boutique est limité à ${maxEquipe} membre(s) d'équipe (hors propriétaire). Passez à un bouquet supérieur depuis le Centre de pilotage pour en ajouter.`,
        );
      }
    }

    const estEmail = dto.identifier.includes("@");
    const utilisateur = await this.prisma.user.findFirst({
      where: estEmail ? { email: dto.identifier } : { phone: dto.identifier },
    });
    if (!utilisateur) {
      throw new NotFoundException(
        "Aucun compte ELEGANZ ne correspond à cet email ou ce numéro. Le collaborateur doit d'abord créer son propre compte.",
      );
    }

    const existing = await this.prisma.shopStaff.findUnique({
      where: { shopId_userId: { shopId, userId: utilisateur.id } },
    });
    if (existing) {
      if (existing.active) {
        throw new ConflictException("Cette personne fait déjà partie de l'équipe de cette boutique.");
      }
      // Déjà membre mais désactivé : on réactive plutôt que de dupliquer la ligne.
      return this.prisma.shopStaff.update({
        where: { id: existing.id },
        data: { active: true, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
      });
    }

    return this.prisma.shopStaff.create({
      data: { shopId, userId: utilisateur.id, role: dto.role, menuItemsOverride: dto.menuItems ?? [] },
    });
  }

  async listStaff(shopId: string) {
    const membres = await this.prisma.shopStaff.findMany({
      where: { shopId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
    // Liste effective des écrans accordés par membre (16 oct. 2026, point 2
    // des propositions du 16 oct. 2026) — calculée ici plutôt que recalculée
    // côté front, pour que GestionShell/équipe affichent toujours la même
    // vérité que ShopMembershipGuard.
    return membres.map((membre) => ({ ...membre, menuItems: ecransEffectifs(membre) }));
  }

  /**
   * Modification d'un profil d'équipe déjà actif (16 oct. 2026, point 2 des
   * propositions du 16 oct. 2026) — n'existait pas avant (seules
   * l'invitation et la suppression). `menuItems` envoyé explicitement
   * (même `[]`) remplace le choix du membre ; absent = ne touche pas aux
   * permissions de menu existantes.
   */
  async updateStaff(shopId: string, staffId: string, dto: UpdateStaffDto) {
    const staff = await this.prisma.shopStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.shopId !== shopId) {
      throw new NotFoundException("Ce membre ne fait pas partie de cette boutique.");
    }
    if (staff.role === StaffRole.OWNER) {
      throw new ConflictException("Le profil du propriétaire ne peut pas être modifié par ce chemin.");
    }
    const mis_a_jour = await this.prisma.shopStaff.update({
      where: { id: staffId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.menuItems !== undefined && { menuItemsOverride: dto.menuItems }),
      },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true } } },
    });
    return { ...mis_a_jour, menuItems: ecransEffectifs(mis_a_jour) };
  }

  async deactivateStaff(shopId: string, staffId: string) {
    const staff = await this.prisma.shopStaff.findUniqueOrThrow({ where: { id: staffId } });
    if (staff.role === StaffRole.OWNER) {
      throw new ConflictException("Le propriétaire de la boutique ne peut pas être retiré.");
    }
    return this.prisma.shopStaff.update({ where: { id: staffId }, data: { active: false } });
  }

  /**
   * Publication volontaire d'une sélection de produits sur la Marketplace
   * (complément stratégique §12). Ne touche jamais aux données de gestion privées.
   *
   * Correctif du 19 oct. 2026 (signalement : "le bouton publier sur la
   * marketplace n'a pas permis de voir le produit même après dix minutes")
   * — `isPubliclyListed` n'était mis à `true` que si `shop.mode ===
   * "PRIVATE"` au moment du clic. Une boutique déjà en HYBRID ou
   * MARKETPLACE (choisi à la création, ou passée là par un autre chemin)
   * ne voyait donc jamais ce champ basculer : `Product.isPublished`
   * passait bien à `true`, mais MarketplaceCatalogService.search() exige
   * AUSSI `shop.isPubliclyListed === true` — le produit restait invisible
   * indéfiniment, sans aucune erreur ni délai à attendre (pas de file
   * d'attente ni de cache ici, juste cette condition jamais remplie).
   * Désormais mis à `true` dans tous les cas dès qu'une publication a
   * lieu ; seul le passage du mode à HYBRID reste réservé aux boutiques
   * PRIVATE (une boutique déjà HYBRID/MARKETPLACE n'a pas besoin que son
   * mode change).
   */
  async publishSelection(shopId: string, productIds: string[]) {
    await this.prisma.product.updateMany({
      where: { id: { in: productIds }, shopId },
      data: { isPublished: true },
    });

    const shop = await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    await this.prisma.shop.update({
      where: { id: shopId },
      data: {
        isPubliclyListed: true,
        mode: shop.mode === "PRIVATE" ? "HYBRID" : shop.mode,
      },
    });

    return this.prisma.product.findMany({ where: { id: { in: productIds } } });
  }

  /**
   * Retire une sélection d'articles de la Marketplace. Ne touche jamais au
   * mode de la boutique (une boutique HYBRID le reste même sans aucun
   * article publié) — seule une action explicite du propriétaire change le
   * mode.
   */
  async unpublishSelection(shopId: string, productIds: string[]) {
    await this.prisma.product.updateMany({
      where: { id: { in: productIds }, shopId },
      data: { isPublished: false },
    });
    return this.prisma.product.findMany({ where: { id: { in: productIds } } });
  }

  /**
   * Vue admin : toutes les boutiques, avec propriétaire et indicateurs
   * essentiels — support du "centre de pilotage" (prompt §40 : gestion de
   * la plateforme sans toucher au code pour les tâches courantes).
   */
  async adminListAll() {
    const shops = await this.prisma.shop.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        marketplaceBouquet: { select: { id: true, name: true } },
        gestionBouquet: { select: { id: true, name: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    return shops;
  }

  /**
   * Confirme (ou retire) l'homologation DGI d'une boutique — c'est ce drapeau,
   * vérifié manuellement par l'admin, qui autorise ensuite la boutique à
   * émettre des INVOICE_FISCAL (décision #9,
   * docs/COMPLIANCE_FACTURE_NORMALISEE.md). Ne génère et ne modifie jamais un
   * document existant : change seulement ce qui devient possible pour les
   * prochains documents.
   */
  async adminSetFiscalHomologation(shopId: string, confirmed: boolean) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({
      where: { id: shopId },
      data: { fiscalHomologationConfirmed: confirmed },
    });
  }

  /**
   * Action manuelle d'un administrateur sur UNE boutique précise (à la
   * différence de BillingService.suspendOverdueShops, qui traite en masse
   * les boutiques en retard de paiement). Ne touche jamais aux commandes,
   * produits ou historiques — seulement au statut d'accès.
   */
  async adminSetStatus(shopId: string, status: ShopStatus) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({ where: { id: shopId }, data: { status } });
  }

  /**
   * Rattache une boutique à un bouquet (plan tarifaire) pour la gestion ou
   * la marketplace — permet à l'admin de changer le forfait d'un vendeur
   * sans toucher au code.
   */
  async adminSetPlan(shopId: string, kind: "gestion" | "marketplace", planId: string | null) {
    await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    return this.prisma.shop.update({
      where: { id: shopId },
      data:
        kind === "gestion"
          ? { gestionBouquetId: planId }
          : { marketplaceBouquetId: planId },
    });
  }

  // ---------------------------------------------------------------------
  // Livreurs propres à la boutique (13 oct. 2026, 1ʳᵉ demande du jour) — en
  // remplacement du réseau de livreurs plateforme, fermé au grand public.
  // Pas de compte ELEGANZ ni de vérification administrative : une simple
  // fiche gérée par la boutique, sous sa seule responsabilité.
  // ---------------------------------------------------------------------

  listShopDrivers(shopId: string) {
    return this.prisma.shopDriver.findMany({
      where: { shopId },
      orderBy: { fullName: "asc" },
    });
  }

  createShopDriver(shopId: string, dto: CreateShopDriverDto) {
    return this.prisma.shopDriver.create({
      data: { shopId, fullName: dto.fullName, phone: dto.phone, vehicleType: dto.vehicleType },
    });
  }

  async updateShopDriver(shopId: string, driverId: string, dto: UpdateShopDriverDto) {
    // findFirstOrThrow avec shopId : empêche une boutique de modifier la
    // fiche livreur d'une autre boutique en devinant un id.
    await this.prisma.shopDriver.findFirstOrThrow({ where: { id: driverId, shopId } });
    return this.prisma.shopDriver.update({ where: { id: driverId }, data: dto });
  }

  // ---------------------------------------------------------------------
  // Zones de livraison (prompt du 15 oct. 2026) — où un vendeur peut
  // livrer, en couples pays+ville précis (jamais de saisie libre), pour
  // rester filtrable côté acheteur (voir MarketplaceCatalogService).
  // ---------------------------------------------------------------------

  listDeliveryZones(shopId: string) {
    return this.prisma.shopDeliveryZone.findMany({
      where: { shopId },
      include: { country: true, city: true },
      orderBy: [{ country: { name: "asc" } }, { city: { name: "asc" } }],
    });
  }

  async addDeliveryZone(shopId: string, dto: AddDeliveryZoneDto) {
    // La ville porte déjà son pays (City.countryId) — on le récupère plutôt
    // que de le demander au client, pour ne jamais stocker un couple
    // pays/ville incohérent.
    const city = await this.prisma.city.findUniqueOrThrow({ where: { id: dto.cityId } });
    return this.prisma.shopDeliveryZone.upsert({
      where: { shopId_cityId: { shopId, cityId: city.id } },
      update: {},
      create: { shopId, cityId: city.id, countryId: city.countryId },
      include: { country: true, city: true },
    });
  }

  async removeDeliveryZone(shopId: string, zoneId: string) {
    // findFirstOrThrow avec shopId : même garde que pour les livreurs —
    // empêche une boutique de retirer la zone d'une autre boutique.
    await this.prisma.shopDeliveryZone.findFirstOrThrow({ where: { id: zoneId, shopId } });
    await this.prisma.shopDeliveryZone.delete({ where: { id: zoneId } });
  }

  // ---------------------------------------------------------------------
  // Fermeture de boutique en libre-service (18 oct. 2026, demande "donner
  // également la main dans le profil la possibilité de supprimer une
  // boutique") — jusqu'ici, aucune boutique ne pouvait jamais être fermée
  // ni par son propriétaire, ni même par un administrateur. Volontairement
  // une fermeture logique (ShopStatus.CLOSED, qui existait déjà dans
  // l'énum mais n'était écrite nulle part) et non une suppression
  // physique : commandes, factures et historique restent consultables,
  // cohérent avec le principe déjà appliqué partout ailleurs sur la
  // plateforme (ex. BillingService.suspendOverdueShops) de ne jamais
  // perdre de données financières.
  // ---------------------------------------------------------------------

  async fermerBoutique(shopId: string) {
    const boutique = await this.prisma.shop.findUniqueOrThrow({ where: { id: shopId } });
    if (boutique.status === ShopStatus.CLOSED) {
      throw new ConflictException("Cette boutique est déjà fermée.");
    }

    // On bloque la fermeture tant qu'il reste une facture ELEGANZ impayée —
    // la boutique doit d'abord régler ses arriérés plutôt que de disparaître
    // en les laissant ouverts (même principe que la réactivation après
    // suspension, voir BillingService.markInvoicePaidAndReactivate).
    const facturesImpayees = await this.prisma.invoice.count({ where: { shopId, status: "PENDING" } });
    if (facturesImpayees > 0) {
      throw new BadRequestException(
        `Impossible de fermer la boutique : ${facturesImpayees} facture(s) ELEGANZ encore impayée(s). Réglez-les d'abord.`,
      );
    }

    return this.prisma.shop.update({
      where: { id: shopId },
      data: { status: ShopStatus.CLOSED, isPubliclyListed: false },
    });
  }
}
