import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRelanceDto } from "./dto/relance.dto";
import { RelanceDirection } from "@eleganz/database";

/**
 * Relances créances & dettes (14 oct. 2026, chantier SYSCOHADA). Un
 * rappel JOURNALISÉ par l'utilisateur, pas un envoi réel de SMS/email —
 * aucun canal de notification n'est construit à cette phase. Voir Doc
 * "Finance & Comptabilité SYSCOHADA — Audit & plan d'intégration".
 */
@Injectable()
export class RelancesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(shopId: string, dto: CreateRelanceDto) {
    if (dto.direction === "CLIENT" && !dto.customerId) {
      throw new BadRequestException("customerId requis pour une relance CLIENT.");
    }
    if (dto.direction === "FOURNISSEUR" && !dto.supplierId) {
      throw new BadRequestException("supplierId requis pour une relance FOURNISSEUR.");
    }
    return this.prisma.relance.create({
      data: {
        shopId,
        direction: dto.direction as RelanceDirection,
        customerId: dto.direction === "CLIENT" ? dto.customerId : undefined,
        supplierId: dto.direction === "FOURNISSEUR" ? dto.supplierId : undefined,
        message: dto.message,
      },
    });
  }

  list(shopId: string) {
    return this.prisma.relance.findMany({
      where: { shopId },
      include: { customer: { select: { fullName: true } }, supplier: { select: { name: true } } },
      orderBy: { envoyeeAt: "desc" },
    });
  }
}
