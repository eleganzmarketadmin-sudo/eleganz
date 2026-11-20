import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateDeliveryZoneDto, RechercherLivreursDto, RegisterDriverDto } from "./dto/delivery.dto";
import { OrderStatus, DriverBillingStatus, DriverVehicleType, NotificationType, PaymentMethod, ShopDriverAccessStatus } from "@eleganz/database";
import { DriverBillingService } from "./driver-billing.service";
import { enregistrerAuditLog } from "../audit/audit-log.util";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly driverBillingService: DriverBillingService,
    private readonly notifications: NotificationsService,
  ) {}

  createZone(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({ data: { commune: dto.commune, fee: dto.fee } });
  }

  listZones() {
    return this.prisma.deliveryZone.findMany({ where: { active: true } });
  }

  /**
   * Réouverture de l'auto-inscription livreur (20 nov. 2026, demande du
   * propriétaire) — fermée depuis le 13 oct. 2026 ("limiter le risque de
   * malhonnêteté au lancement"). S'inscrire ici ne vaut plus garantie
   * ELEGANZ : c'est une offre de service du livreur lui-même (personne
   * physique ou morale), avec ses propres conditions (voir `conditions`
   * ci-dessous, et `accepteConditions` validé côté DTO). Une boutique ne
   * peut affecter ce livreur à une livraison qu'après l'avoir d'abord
   * ajouté à sa propre liste de livreurs agréés ET que le livreur ait
   * accepté — voir demanderAccesLivreur/repondreDemandeLivreur ci-dessous
   * et le garde ajouté dans assignDriver(). La responsabilité de la
   * livraison reste entièrement celle de la boutique qui le choisit,
   * jamais celle de la plateforme (voir docs/ARCHITECTURE_FINANCE.md).
   * `ShopDriver` (fiche sans compte, gérée par une boutique) n'est en rien
   * affecté par cette réouverture — mécanisme parallèle inchangé.
   */
  async registerDriver(userId: string, dto: RegisterDriverDto) {
    const existant = await this.prisma.driver.findUnique({ where: { userId } });
    if (existant) {
      throw new BadRequestException("Un profil livreur existe déjà pour ce compte.");
    }
    return this.prisma.driver.create({
      data: {
        userId,
        zone: dto.zone,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        address: dto.address,
        vehicleType: dto.vehicleType,
        vehiclePlate: dto.vehiclePlate,
        licenseNumber: dto.licenseNumber,
        idDocumentNumber: dto.idDocumentNumber,
        conditions: dto.conditions,
      },
    });
  }

  /**
   * Affecte, réaffecte ou retire un livreur d'une sous-commande (prompt du
   * 13 oct. 2026, point 1 — le vendeur garde la main et peut changer de
   * livreur en cas de besoin). `driverId: null` retire l'affectation sans
   * exiger de vérification ; affecter un livreur exige qu'il soit vérifié.
   *
   * Garde ajoutée le 20 nov. 2026 (réouverture du réseau livreur) : une
   * boutique ne peut affecter un livreur du réseau ELEGANZ que s'il fait
   * déjà partie de SA propre liste de livreurs agréés (ShopDriverAccess en
   * statut ACTIVE, donc déjà accepté par le livreur) — jamais un ajout
   * unilatéral à l'affectation. N'affecte en rien assignShopDriver()
   * ci-dessous (livreur sans compte, propre à la boutique).
   */
  async assignDriver(shopId: string, shopOrderId: string, driverId: string | null) {
    if (driverId) {
      const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
      if (!driver.verified) {
        throw new BadRequestException("Ce livreur n'est pas encore vérifié.");
      }
      // Deux verrous indépendants (prompt du 13 oct. 2026, point 1) :
      // l'identité/le dossier (`verified`, ci-dessus) et la facturation
      // (`billingStatus`, ici) — un livreur suspendu pour impayé ne reçoit
      // plus de nouvelles missions tant qu'il n'est pas réactivé.
      if (driver.billingStatus === DriverBillingStatus.SUSPENDED) {
        throw new BadRequestException("Ce livreur est suspendu pour impayé de son abonnement.");
      }
      const acces = await this.prisma.shopDriverAccess.findUnique({
        where: { shopId_driverId: { shopId, driverId } },
      });
      if (!acces || acces.status !== ShopDriverAccessStatus.ACTIVE) {
        throw new BadRequestException("Ce livreur n'est pas encore dans votre liste de livreurs agréés.");
      }
    }
    return this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { driverId } });
  }

  // --- Réseau de livreurs ELEGANZ : recherche, demande, acceptation -------
  // (réouverture du 20 nov. 2026 — voir le commentaire de registerDriver)

  /**
   * Recherche de livreurs vérifiés depuis le module Gestion, avant demande
   * d'ajout à la liste de livreurs agréés — même restriction que
   * listVerifiedDrivers() (ni pièce d'identité ni permis exposés), avec en
   * plus `conditions` (l'offre de service du livreur, informative) et des
   * filtres optionnels.
   */
  rechercherLivreurs(filtres: RechercherLivreursDto) {
    return this.prisma.driver.findMany({
      where: {
        verified: true,
        billingStatus: { not: DriverBillingStatus.SUSPENDED },
        ...(filtres.zone ? { zone: { contains: filtres.zone, mode: "insensitive" } } : {}),
        ...(filtres.vehicleType ? { vehicleType: filtres.vehicleType as DriverVehicleType } : {}),
      },
      select: {
        id: true,
        zone: true,
        phone: true,
        whatsapp: true,
        vehicleType: true,
        conditions: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    });
  }

  /**
   * Demande d'ajout d'un livreur à la liste de livreurs agréés d'une
   * boutique — ne donne PAS accès à l'affectation tant que le livreur n'a
   * pas répondu (voir repondreDemandeLivreur). Réactive une ancienne
   * demande refusée/révoquée plutôt que d'empiler les lignes pour un même
   * couple boutique/livreur (@@unique([shopId, driverId]) sur
   * ShopDriverAccess).
   */
  async demanderAccesLivreur(shopId: string, driverId: string, userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver || !driver.verified) {
      throw new BadRequestException("Ce livreur n'est pas disponible dans le réseau ELEGANZ.");
    }
    const existant = await this.prisma.shopDriverAccess.findUnique({
      where: { shopId_driverId: { shopId, driverId } },
    });
    if (existant?.status === ShopDriverAccessStatus.ACTIVE) {
      throw new ConflictException("Ce livreur est déjà dans votre liste de livreurs agréés.");
    }
    if (existant?.status === ShopDriverAccessStatus.PENDING) {
      throw new ConflictException("Une demande est déjà en attente de réponse pour ce livreur.");
    }
    const acces = existant
      ? await this.prisma.shopDriverAccess.update({
          where: { id: existant.id },
          data: {
            status: ShopDriverAccessStatus.PENDING,
            requestedByUserId: userId,
            respondedAt: null,
            revokedAt: null,
          },
        })
      : await this.prisma.shopDriverAccess.create({
          data: { shopId, driverId, requestedByUserId: userId },
        });

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId }, select: { name: true } });
    await this.notifications.notifierUtilisateurs([driver.userId], {
      type: NotificationType.LIVREUR_DEMANDE_RECUE,
      title: "Nouvelle demande de boutique",
      body: `${shop?.name ?? "Une boutique"} souhaite vous ajouter à sa liste de livreurs agréés.`,
      link: "/livreur/demandes",
    });
    return acces;
  }

  /** Demandes reçues par le livreur connecté (toutes, pour qu'il voie aussi l'historique). */
  async mesDemandesLivreur(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) return [];
    return this.prisma.shopDriverAccess.findMany({
      where: { driverId: driver.id },
      include: {
        shop: { select: { id: true, name: true, invoiceAddress: true, invoicePhone: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Réponse du livreur à une demande reçue — accepter fait passer l'accès
   * en ACTIVE (la boutique peut dès lors l'affecter à une livraison via
   * assignDriver ci-dessus), refuser en DECLINED. Jamais un ajout
   * unilatéral de la boutique.
   */
  async repondreDemandeLivreur(userId: string, accessId: string, accepte: boolean) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) {
      throw new BadRequestException("Aucun profil livreur pour ce compte.");
    }
    const acces = await this.prisma.shopDriverAccess.findUnique({ where: { id: accessId } });
    if (!acces || acces.driverId !== driver.id) {
      throw new NotFoundException("Demande introuvable.");
    }
    if (acces.status !== ShopDriverAccessStatus.PENDING) {
      throw new ConflictException("Cette demande n'est plus en attente.");
    }
    const updated = await this.prisma.shopDriverAccess.update({
      where: { id: accessId },
      data: {
        status: accepte ? ShopDriverAccessStatus.ACTIVE : ShopDriverAccessStatus.DECLINED,
        respondedAt: new Date(),
      },
    });
    await this.notifierBoutique(
      acces.shopId,
      NotificationType.LIVREUR_DEMANDE_REPONDUE,
      "Réponse d'un livreur",
      accepte
        ? "Un livreur a accepté votre demande et fait maintenant partie de votre liste de livreurs agréés."
        : "Un livreur a refusé votre demande d'ajout à votre liste de livreurs agréés.",
      "/livreurs",
    );
    return updated;
  }

  /** Liste de livreurs agréés d'une boutique (tous statuts, pour l'écran Gestion). */
  mesLivreursAgrees(shopId: string) {
    return this.prisma.shopDriverAccess.findMany({
      where: { shopId },
      include: {
        driver: {
          select: {
            id: true,
            zone: true,
            phone: true,
            whatsapp: true,
            vehicleType: true,
            conditions: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async revoquerAccesLivreur(shopId: string, accessId: string) {
    const acces = await this.prisma.shopDriverAccess.findUnique({ where: { id: accessId } });
    if (!acces || acces.shopId !== shopId) {
      throw new NotFoundException("Accès livreur introuvable pour cette boutique.");
    }
    return this.prisma.shopDriverAccess.update({
      where: { id: accessId },
      data: { status: ShopDriverAccessStatus.REVOKED, revokedAt: new Date() },
    });
  }

  /** Notifie le propriétaire + le personnel actif d'une boutique (même sélection que notifierBoutiquesCommandeRecue, orders.service.ts). */
  private async notifierBoutique(shopId: string, type: NotificationType, title: string, body: string, link: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { ownerId: true, staff: { where: { active: true }, select: { userId: true } } },
    });
    if (!shop) return;
    const destinataires = [shop.ownerId, ...shop.staff.map((s) => s.userId)];
    await this.notifications.notifierUtilisateurs(destinataires, { type, title, body, link });
  }

  /**
   * Même principe qu'assignDriver() ci-dessus, mais pour un livreur propre
   * à la boutique (ShopDriver — 13 oct. 2026, 1ʳᵉ demande du jour) : pas de
   * vérification plateforme à contrôler, juste que la fiche appartienne
   * bien à CETTE boutique (shopId) et soit active. `shopDriverId: null`
   * retire l'affectation. On efface aussi l'éventuel driverId plateforme
   * historique pour qu'une sous-commande n'ait jamais les deux à la fois.
   */
  async assignShopDriver(shopId: string, shopOrderId: string, shopDriverId: string | null) {
    if (shopDriverId) {
      const shopDriver = await this.prisma.shopDriver.findFirstOrThrow({
        where: { id: shopDriverId, shopId },
      });
      if (!shopDriver.active) {
        throw new BadRequestException("Ce livreur a été désactivé par la boutique.");
      }
    }
    return this.prisma.shopOrder.update({
      where: { id: shopOrderId },
      data: { shopDriverId, driverId: null },
    });
  }

  /**
   * Livreurs vérifiés disponibles à l'affectation, pour le sélecteur côté
   * vendeur (prompt du 13 oct. 2026, point 1) — aucune donnée sensible
   * (pièce d'identité, permis) n'est exposée ici, seulement de quoi choisir
   * et contacter.
   */
  listVerifiedDrivers() {
    return this.prisma.driver.findMany({
      // Un livreur suspendu pour impayé (billingStatus) n'apparaît plus
      // dans le sélecteur d'affectation du vendeur, même vérifié — même
      // verrou que dans assignDriver(), appliqué ici en amont pour l'UX.
      where: { verified: true, billingStatus: { not: DriverBillingStatus.SUSPENDED } },
      select: {
        id: true,
        zone: true,
        phone: true,
        whatsapp: true,
        vehicleType: true,
        user: { select: { fullName: true } },
      },
      orderBy: { user: { fullName: "asc" } },
    });
  }

  async myProfile(userId: string) {
    return this.prisma.driver.findUnique({
      where: { userId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    });
  }

  adminListDrivers() {
    return this.prisma.driver.findMany({
      include: {
        user: { select: { fullName: true, email: true, phone: true, createdAt: true, isSuspended: true } },
        _count: { select: { deliveries: true } },
      },
      orderBy: { user: { createdAt: "desc" } },
    });
  }

  async adminSetVerified(driverId: string, verified: boolean, adminUserId: string) {
    const driver = await this.prisma.driver.update({ where: { id: driverId }, data: { verified } });
    // La gratuité démarre précisément à la validation du dossier par
    // l'admin (prompt du 13 oct. 2026, point 1), jamais à l'inscription.
    if (verified) {
      await this.driverBillingService.startFreeTrialIfNeeded(driverId);
    }
    // Piste d'audit interne (18 nov. 2026) — voir audit-log.util.ts.
    await enregistrerAuditLog(this.prisma, {
      actorId: adminUserId,
      action: verified ? "LIVREUR_VERIFIE" : "LIVREUR_VERIFICATION_RETIREE",
      details: { driverId },
    });
    return driver;
  }

  /** Note interne pendant l'instruction du dossier — jamais visible du livreur. */
  adminSetNote(driverId: string, adminNote: string) {
    return this.prisma.driver.update({ where: { id: driverId }, data: { adminNote } });
  }

  async myDeliveries(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) return [];
    return this.prisma.shopOrder.findMany({
      where: { driverId: driver.id },
      include: {
        lines: true,
        shop: { select: { name: true, invoiceAddress: true, invoicePhone: true } },
        // Coordonnées de livraison nécessaires au livreur (prompt §43) ; pas
        // plus d'informations personnelles de l'acheteur que nécessaire —
        // ni son email, ni son identifiant de compte.
        order: {
          select: {
            buyerWhatsapp: true,
            buyerPhone: true,
            deliveryCommune: true,
            deliveryQuartier: true,
            deliveryAvenue: true,
            deliveryRepere: true,
            deliveryNote: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  private async assertAssignedDriver(shopOrderId: string, userId: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { driver: true, order: { include: { payments: { select: { method: true } } } } },
    });
    if (!shopOrder.driver || shopOrder.driver.userId !== userId) {
      throw new ForbiddenException("Cette livraison ne vous est pas assignée.");
    }
    return shopOrder;
  }

  async confirmPickup(shopOrderId: string, userId: string) {
    const shopOrder = await this.assertAssignedDriver(shopOrderId, userId);
    // `shopOrder.shopId` vient de l'enregistrement déjà chargé par
    // `assertAssignedDriver`, qui vient de vérifier que ce livreur y est
    // bien affecté — pas d'IDOR possible ici, juste la forme exigée par
    // transitionStatus.
    await this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.PICKED_UP);
    const updated = await this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.IN_TRANSIT);
    // La boutique est notifiée ici de l'étape franchie PAR LE LIVREUR (20
    // nov. 2026) — contrairement à une mise à jour de statut faite par son
    // propre personnel (PATCH /shops/:shopId/orders/:shopOrderId/status),
    // qui n'a pas besoin de se notifier elle-même. L'acheteur l'est déjà par
    // OrdersService.transitionStatus (ETAPES_NOTIFIEES_ACHETEUR).
    await this.notifierBoutique(
      shopOrder.shopId,
      NotificationType.LIVRAISON_ETAPE_MISE_A_JOUR,
      "Étape de livraison",
      "Le livreur a récupéré le colis chez vous — en route pour la livraison.",
      "/commandes",
    );
    return updated;
  }

  /**
   * Déclaration de livraison par le livreur — un événement distinct de la
   * confirmation de réception par l'acheteur (prompt §46). `proofCode` est
   * désormais vérifié contre ShopOrder.deliveryCode, généré au passage à
   * IN_TRANSIT et communiqué à l'acheteur (18 oct. 2026, audit "preuve de
   * livraison simulée/placeholder" — voir OrdersService.transitionStatus,
   * seul endroit qui le vérifie réellement, pour que ce contrôleur réseau
   * livreur et la transition déclenchée par le personnel boutique partagent
   * exactement la même règle).
   */
  async confirmDelivery(shopOrderId: string, userId: string, proofCode?: string) {
    const shopOrder = await this.assertAssignedDriver(shopOrderId, userId);
    // Circuit paiement à la livraison (10 nov. 2026, point 2) : ce livreur
    // perçoit lui-même l'argent au moment de la remise, donc sa déclaration
    // de livraison vaut aussi confirmation du paiement — on traverse
    // PAYMENT_CONFIRMED (ALLOWED_TRANSITIONS_PAIEMENT_LIVRAISON) dans le même
    // geste plutôt que d'exiger une étape séparée que ce flux livreur n'a
    // jamais eu d'écran pour déclencher.
    if (shopOrder.order.payments[0]?.method === PaymentMethod.CASH_ON_DELIVERY && shopOrder.status === OrderStatus.IN_TRANSIT) {
      await this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.PAYMENT_CONFIRMED);
    }
    const updated = await this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.DELIVERED_DECLARED, proofCode);
    await this.notifierBoutique(
      shopOrder.shopId,
      NotificationType.LIVRAISON_ETAPE_MISE_A_JOUR,
      "Étape de livraison",
      "Le livreur a déclaré le colis livré.",
      "/commandes",
    );
    return updated;
  }
}
