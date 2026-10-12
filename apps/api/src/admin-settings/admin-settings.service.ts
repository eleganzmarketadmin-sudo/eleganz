import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";

const ID_SINGLETON = "platform";

/**
 * Coordonnées officielles de la plateforme (adresse, site web, contact,
 * réseaux sociaux) — une seule ligne en base, créée à la première lecture
 * si elle n'existe pas encore. Utilisées à la fois par le Centre de
 * pilotage (pour les modifier) et par la génération des documents
 * commerciaux (pour la signature ELEGANZ en bas de chaque facture/ticket).
 */
@Injectable()
export class AdminSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existant = await this.prisma.platformSettings.findUnique({ where: { id: ID_SINGLETON } });
    if (existant) return existant;
    return this.prisma.platformSettings.create({ data: { id: ID_SINGLETON } });
  }

  async update(dto: UpdatePlatformSettingsDto) {
    await this.get(); // garantit que la ligne existe avant la mise à jour
    return this.prisma.platformSettings.update({
      where: { id: ID_SINGLETON },
      data: {
        ...(dto.address !== undefined && { address: dto.address || null }),
        ...(dto.website !== undefined && { website: dto.website || null }),
        ...(dto.supportEmail !== undefined && { supportEmail: dto.supportEmail || null }),
        ...(dto.supportPhone !== undefined && { supportPhone: dto.supportPhone || null }),
        ...(dto.whatsappLink !== undefined && { whatsappLink: dto.whatsappLink || null }),
        ...(dto.telegramLink !== undefined && { telegramLink: dto.telegramLink || null }),
        ...(dto.tiktokUrl !== undefined && { tiktokUrl: dto.tiktokUrl || null }),
        ...(dto.instagramUrl !== undefined && { instagramUrl: dto.instagramUrl || null }),
      },
    });
  }
}
