import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { CreateDeliveryZoneDto, RegisterDriverDto } from "./dto/delivery.dto";
import { OrderStatus, DriverBillingStatus } from "@eleganz/database";
import { DriverBillingService } from "./driver-billing.service";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    private readonly driverBillingService: DriverBillingService,
  ) {}

  createZone(dto: CreateDeliveryZoneDto) {
    return this.prisma.deliveryZone.create({ data: { commune: dto.commune, fee: dto.fee } });
  }

  listZones() {
    return this.prisma.deliveryZone.findMany({ where: { active: true } });
  }

  /**
   * Inscription livreur FERMÉE au grand public (décision du 13 oct. 2026,
   * 3ᵉ demande du jour) : un réseau de livreurs ouvert à tout le monde dès
   * le lancement présente un risque de malhonnêteté trop élevé (vol, perte
   * de marchandise, sans garantie de sérieux du livreur). Chaque boutique
   * gère maintenant ses propres livreurs sous sa propre responsabilité —
   * voir ShopDriversService. Le code ci-dessous est conservé intact pour
   * une réouverture future du réseau plateforme, juste rendu inatteignable
   * par ce refus en première ligne.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async registerDriver(userId: string, _dto: RegisterDriverDto) {
    throw new ForbiddenException(
      "L'inscription livreur est temporairement fermée. Chaque boutique gère pour l'instant ses propres livreurs.",
    );
  }

  /**
   * Affecte, réaffecte ou retire un livreur d'une sous-commande (prompt du
   * 13 oct. 2026, point 1 — le vendeur garde la main et peut changer de
   * livreur en cas de besoin). `driverId: null` retire l'affectation sans
   * exiger de vérification ; affecter un livreur exige qu'il soit vérifié.
   */
  async assignDriver(shopOrderId: string, driverId: string | null) {
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
    }
    return this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { driverId } });
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

  async adminSetVerified(driverId: string, verified: boolean) {
    const driver = await this.prisma.driver.update({ where: { id: driverId }, data: { verified } });
    // La gratuité démarre précisément à la validation du dossier par
    // l'admin (prompt du 13 oct. 2026, point 1), jamais à l'inscription.
    if (verified) {
      await this.driverBillingService.startFreeTrialIfNeeded(driverId);
    }
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
      include: { driver: true },
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
    return this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.IN_TRANSIT);
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
    return this.ordersService.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.DELIVERED_DECLARED, proofCode);
  }
}
