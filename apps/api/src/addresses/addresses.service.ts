import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateAddressDto, UpdateAddressDto } from "./dto/address.dto";

/**
 * Carnet d'adresses de l'acheteur (prompt du 15 oct. 2026, point 2) — le
 * modèle Prisma `Address` existait déjà (lié à `User`) mais n'était utilisé
 * par aucune route avant ce service : la commande Marketplace saisissait
 * les champs de livraison à chaque fois, sans jamais les enregistrer.
 */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  lister(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { id: "asc" }],
    });
  }

  private async verifierProprietaire(userId: string, addressId: string) {
    const adresse = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!adresse) {
      throw new NotFoundException("Adresse introuvable.");
    }
    if (adresse.userId !== userId) {
      throw new ForbiddenException("Cette adresse ne vous appartient pas.");
    }
    return adresse;
  }

  async creer(userId: string, dto: CreateAddressDto) {
    if (dto.isDefault) {
      await this.prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    }
    return this.prisma.address.create({
      data: {
        userId,
        commune: dto.commune,
        quartier: dto.quartier,
        avenue: dto.avenue,
        repere: dto.repere,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async modifier(userId: string, addressId: string, dto: UpdateAddressDto) {
    await this.verifierProprietaire(userId, addressId);
    if (dto.isDefault) {
      await this.prisma.address.updateMany({
        where: { userId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }
    return this.prisma.address.update({
      where: { id: addressId },
      data: {
        ...(dto.commune !== undefined ? { commune: dto.commune } : {}),
        ...(dto.quartier !== undefined ? { quartier: dto.quartier } : {}),
        ...(dto.avenue !== undefined ? { avenue: dto.avenue } : {}),
        ...(dto.repere !== undefined ? { repere: dto.repere } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
      },
    });
  }

  async supprimer(userId: string, addressId: string) {
    await this.verifierProprietaire(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }
}
