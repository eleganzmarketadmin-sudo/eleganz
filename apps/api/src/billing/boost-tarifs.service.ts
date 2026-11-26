import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBoostTarifDto, UpdateBoostTarifDto } from "./dto/boost-tarif.dto";
import { BoostCible } from "@eleganz/database";

/**
 * Catalogue de forfaits Boost (26 nov. 2026, demande propriétaire) — même
 * esprit que SubscriptionPlansService : forfaits fixes par durée,
 * entièrement configurables par l'admin depuis /admin/tarifs, aucune valeur
 * figée dans le code. Aucun seed de départ : contrairement aux bouquets
 * Gestion (dont une boutique a besoin dès sa création), un tarif Boost
 * n'existe que si l'admin en crée un — pas de prix à inventer ici.
 */
@Injectable()
export class BoostTarifsService {
  constructor(private readonly prisma: PrismaService) {}

  // Public : une boutique doit pouvoir consulter les forfaits disponibles
  // pour démarrer un boost sans passer par l'admin.
  list(cible?: BoostCible) {
    return this.prisma.boostTarif.findMany({
      where: { actif: true, ...(cible ? { cible } : {}) },
      orderBy: [{ cible: "asc" }, { dureeJours: "asc" }],
    });
  }

  /**
   * Vue admin : tous les tarifs, y compris désactivés — nécessaire pour
   * pouvoir réactiver un forfait retiré sans repasser par la base de
   * données directement (même convention que SubscriptionPlansService.listAll).
   */
  listAll(cible?: BoostCible) {
    return this.prisma.boostTarif.findMany({
      where: cible ? { cible } : {},
      orderBy: [{ cible: "asc" }, { dureeJours: "asc" }],
    });
  }

  create(dto: CreateBoostTarifDto) {
    return this.prisma.boostTarif.create({
      data: {
        cible: dto.cible,
        dureeJours: dto.dureeJours,
        prix: dto.prix,
      },
    });
  }

  update(tarifId: string, dto: UpdateBoostTarifDto) {
    return this.prisma.boostTarif.update({
      where: { id: tarifId },
      data: {
        dureeJours: dto.dureeJours,
        prix: dto.prix,
        actif: dto.actif,
      },
    });
  }
}
