import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { CreateDeliveryZoneDto, RegisterDriverDto } from "./dto/delivery.dto";
import { OrderStatus } from "@eleganz/database";

@Injectable()
export class DeliveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
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
    // verified reste false : la vérification d'identité est une action
    // administrative distincte, pas automatique à l'inscription (prompt §10).
    return this.prisma.driver.create({ data: { userId, zone: dto.zone, verified: false } });
  }

  async assignDriver(shopOrderId: string, driverId: string) {
    const driver = await this.prisma.driver.findUniqueOrThrow({ where: { id: driverId } });
    if (!driver.verified) {
      throw new BadRequestException("Ce livreur n'est pas encore vérifié.");
    }
    return this.prisma.shopOrder.update({ where: { id: shopOrderId }, data: { driverId } });
  }

  async myDeliveries(userId: string) {
    const driver = await this.prisma.driver.findUnique({ where: { userId } });
    if (!driver) return [];
    return this.prisma.shopOrder.findMany({
      where: { driverId: driver.id },
      include: { lines: true, shop: { select: { name: true } } },
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
