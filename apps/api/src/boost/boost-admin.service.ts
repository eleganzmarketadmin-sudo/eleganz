import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BoostCanal } from "@eleganz/database";
import { UpsertBoostCanalConfigDto, CreateBoostCoutExterneDto } from "./dto/boost-admin.dto";

/**
 * Centre de pilotage ELEGANZ BOOST (27 nov. 2026, refonte à partir de la
 * proposition de tarification fournie par le propriétaire) — regroupe ce
 * qui ne relève ni du catalogue de tarifs (BoostTarifsService) ni du suivi
 * opérationnel des boosts en cours (BoostService) : canaux publicitaires
 * externes (réponse Q1 : champs structurés "déjà prévus", prêts à être
 * connectés, aucun appel réel câblé), coûts externes saisis manuellement, et
 * le rapport de rentabilité qui en découle.
 */
@Injectable()
export class BoostAdminService implements OnModuleInit {
  private readonly logger = new Logger(BoostAdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Un enregistrement par canal dès le démarrage (jamais recréé s'il existe
  // déjà) — pour que l'écran admin ait toujours les 5 lignes à afficher,
  // même avant toute configuration.
  async onModuleInit() {
    try {
      for (const canal of Object.values(BoostCanal)) {
        const dejaPresent = await this.prisma.boostCanalConfig.findUnique({ where: { canal } });
        if (!dejaPresent) {
          await this.prisma.boostCanalConfig.create({ data: { canal } });
        }
      }
    } catch (err) {
      this.logger.error("Échec de l'initialisation des canaux Boost", err);
    }
  }

  // --- Canaux publicitaires externes ---

  listerCanaux() {
    return this.prisma.boostCanalConfig.findMany({ orderBy: { canal: "asc" } });
  }

  /**
   * `connecte` reste une simple annotation manuelle de l'admin (réponse Q1 :
   * "les options API déjà prévues... qu'on va connecter seulement") — aucun
   * code de ce chantier n'appelle réellement l'API du canal, quelle que
   * soit la valeur ici.
   */
  configurerCanal(canal: BoostCanal, dto: UpsertBoostCanalConfigDto) {
    return this.prisma.boostCanalConfig.upsert({
      where: { canal },
      update: {
        connecte: dto.connecte,
        apiKey: dto.apiKey,
        apiSecret: dto.apiSecret,
        accountId: dto.accountId,
        notes: dto.notes,
      },
      create: {
        canal,
        connecte: dto.connecte ?? false,
        apiKey: dto.apiKey,
        apiSecret: dto.apiSecret,
        accountId: dto.accountId,
        notes: dto.notes,
      },
    });
  }

  // --- Coûts externes (saisie manuelle, faute de connexion réelle) ---

  listerCoutsExternes(periode?: string) {
    return this.prisma.boostCoutExterne.findMany({
      where: periode ? { periode } : {},
      orderBy: [{ periode: "desc" }, { createdAt: "desc" }],
    });
  }

  ajouterCoutExterne(dto: CreateBoostCoutExterneDto, userId: string) {
    return this.prisma.boostCoutExterne.create({
      data: {
        canal: dto.canal,
        periode: dto.periode,
        montantUSD: dto.montantUSD,
        note: dto.note,
        createdByUserId: userId,
      },
    });
  }

  supprimerCoutExterne(id: string) {
    return this.prisma.boostCoutExterne.delete({ where: { id } });
  }

  // --- Rapport de rentabilité ---

  /**
   * Revenu Boost = somme des factures `kind="boost"` marquées PAID (jamais
   * le montant catalogue du tarif — qui peut avoir changé depuis, ni le
   * montant d'une facture encore en attente). Marge indicative seulement :
   * revenu × (1 − tauxChargesDirectesPct/100), moins les coûts externes
   * saisis manuellement sur la période — jamais une comptabilité réelle,
   * un indicateur de pilotage (voir PlatformSettings.boostTauxChargesDirectesPct).
   */
  async rapportRentabilite(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = to ? new Date(to) : new Date();

    const [boostsPayes, couts, settings] = await Promise.all([
      this.prisma.boost.findMany({
        where: { invoice: { status: "PAID", paidAt: { gte: fromDate, lte: toDate } } },
        select: { cible: true, montant: true, invoice: { select: { paidAt: true } } },
      }),
      this.prisma.boostCoutExterne.findMany({
        where: {
          periode: {
            gte: `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}`,
            lte: `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}`,
          },
        },
      }),
      this.prisma.platformSettings.findUnique({
        where: { id: "platform" },
        select: { boostTauxChargesDirectesPct: true },
      }),
    ]);

    const revenuParFamille: Record<string, number> = {};
    let revenuTotal = 0;
    for (const b of boostsPayes) {
      const montant = Number(b.montant);
      revenuParFamille[b.cible] = (revenuParFamille[b.cible] ?? 0) + montant;
      revenuTotal += montant;
    }

    const coutsExternesTotal = couts.reduce(
      (somme: number, c: { montantUSD: unknown }) => somme + Number(c.montantUSD),
      0,
    );
    const tauxCharges = settings?.boostTauxChargesDirectesPct ?? 20;
    const margeEstimee = Math.round((revenuTotal * (1 - tauxCharges / 100) - coutsExternesTotal) * 100) / 100;

    return {
      periode: { from: fromDate.toISOString(), to: toDate.toISOString() },
      revenuTotal: Math.round(revenuTotal * 100) / 100,
      revenuParFamille,
      coutsExternesTotal: Math.round(coutsExternesTotal * 100) / 100,
      tauxChargesDirectesPct: tauxCharges,
      margeEstimee,
      nombreBoostsPayes: boostsPayes.length,
    };
  }
}
