import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GEO_SEED } from "./geo-seed-data";

/**
 * Pays/villes de référence pour les zones de livraison des vendeurs
 * (prompt du 15 oct. 2026). Seed idempotente (comme AccountingSeedService) :
 * exécutée paresseusement au premier appel, jamais au démarrage du process
 * — aucune migration ni script à lancer à la main après un déploiement.
 */
@Injectable()
export class GeoService {
  private seeded = false;

  constructor(private readonly prisma: PrismaService) {}

  private async ensureSeeded() {
    if (this.seeded) return;

    for (const pays of GEO_SEED) {
      const country = await this.prisma.country.upsert({
        where: { isoCode: pays.isoCode },
        update: { name: pays.name, continent: pays.continent },
        create: { isoCode: pays.isoCode, name: pays.name, continent: pays.continent },
      });

      for (const nomVille of pays.villes) {
        await this.prisma.city.upsert({
          where: { countryId_name: { countryId: country.id, name: nomVille } },
          update: {},
          create: { countryId: country.id, name: nomVille },
        });
      }
    }

    this.seeded = true;
  }

  async listPays() {
    await this.ensureSeeded();
    return this.prisma.country.findMany({
      orderBy: [{ continent: "asc" }, { name: "asc" }],
    });
  }

  async listVilles(countryId: string) {
    await this.ensureSeeded();
    return this.prisma.city.findMany({
      where: { countryId },
      orderBy: { name: "asc" },
    });
  }
}
