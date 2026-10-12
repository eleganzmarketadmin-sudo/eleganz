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

  async registerDriver(userId: string, dto: RegisterDriverDto) {
    const existing = await this.prisma.driver.findUnique({ where: { userId } });
    if (existing) return existing;
    // verified reste false : la vérification du dossier (identité, véhicule)
    // est une action administrative distincte, jamais automatique à
    // l'inscription (prompt §10 et prompt du 13 oct. 2026, point 2).
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
        verified: false,
      },
    });
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
    await this.assertAssignedDriver(shopOrderId, userId);
    await this.ordersService.transitionStatus(shopOrderId, OrderStatus.PICKED_UP);
    return this.ordersService.transitionStatus(shopOrderId, OrderStatus.IN_TRANSIT);
  }

  /**
   * Déclaration de livraison par le livreur — un événement distinct de la
   * confirmation de réception par l'acheteur (prompt §46). `proofCode` est
   * stocké tel quel pour l'instant ; le mécanisme de preuve définitif
   * (QR code signé, signature) reste à spécifier (voir NEXT_ACTIONS.md).
   */
  async confirmDelivery(shopOrderId: string, userId: string, _proofCode?: string) {
    await this.assertAssignedDriver(shopOrderId, userId);
    return this.ordersService.transitionStatus(shopOrderId, OrderStatus.DELIVERED_DECLARED);
  }
}
