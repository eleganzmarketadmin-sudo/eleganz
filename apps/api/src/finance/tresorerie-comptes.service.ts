import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { AccountingQueryService } from "./accounting-query.service";
import { CreateMouvementTresorerieDto, CreateRapprochementDto, CreateTresorerieCompteDto } from "./dto/tresorerie.dto";
import { AccountNormalSide, FiscalRuleScope, TresorerieCompteType } from "@eleganz/database";

const PREFIXE_PAR_TYPE: Record<TresorerieCompteType, string> = {
  BANQUE: "521",
  MOBILE_MONEY: "532",
};

/**
 * Trésorerie multi-comptes (chantier SYSCOHADA réactivé, phase 2 — 14 oct.
 * 2026). Chaque compte réel (une banque, une ligne mobile money) obtient son
 * propre sous-compte de grand livre, numéroté "521-01", "521-02", "532-01"...
 * — jamais un compte 521/532 générique partagé, pour que le rapprochement et
 * le relevé restent compte par compte. Voir Doc "Finance & Comptabilité
 * SYSCOHADA — Audit & plan d'intégration", tabs D/E.
 *
 * Généralisé au scope PLATFORM le 18 oct. 2026 (audit du 18 oct. 2026,
 * point 6 : "Trésorerie multi-comptes et immobilisations plateforme
 * absentes") — même pattern que FiscalRulesService/AssetsService : chaque
 * méthode publique "ForShop"/"ForPlatform" filtre systématiquement sur son
 * scope, jamais l'un ne peut lire/écrire l'autre.
 */
@Injectable()
export class TresorerieComptesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly accountingQuery: AccountingQueryService,
  ) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async listForShop(shopId: string) {
    return this.lister(FiscalRuleScope.SHOP, shopId);
  }

  async create(shopId: string, dto: CreateTresorerieCompteDto) {
    return this.creer(FiscalRuleScope.SHOP, shopId, dto);
  }

  async desactiver(shopId: string, compteId: string) {
    return this.desactiverCompte(FiscalRuleScope.SHOP, shopId, compteId);
  }

  async enregistrerMouvement(shopId: string, compteId: string, dto: CreateMouvementTresorerieDto) {
    return this.enregistrer(FiscalRuleScope.SHOP, shopId, compteId, dto);
  }

  async creerRapprochement(shopId: string, compteId: string, dto: CreateRapprochementDto) {
    return this.creerRapprochementCompte(FiscalRuleScope.SHOP, shopId, compteId, dto);
  }

  async listerRapprochements(shopId: string, compteId: string) {
    return this.listerRapprochementsCompte(FiscalRuleScope.SHOP, shopId, compteId);
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  async listForPlatform() {
    return this.lister(FiscalRuleScope.PLATFORM, null);
  }

  async createForPlatform(dto: CreateTresorerieCompteDto) {
    return this.creer(FiscalRuleScope.PLATFORM, null, dto);
  }

  async desactiverForPlatform(compteId: string) {
    return this.desactiverCompte(FiscalRuleScope.PLATFORM, null, compteId);
  }

  async enregistrerMouvementForPlatform(compteId: string, dto: CreateMouvementTresorerieDto) {
    return this.enregistrer(FiscalRuleScope.PLATFORM, null, compteId, dto);
  }

  async creerRapprochementForPlatform(compteId: string, dto: CreateRapprochementDto) {
    return this.creerRapprochementCompte(FiscalRuleScope.PLATFORM, null, compteId, dto);
  }

  async listerRapprochementsForPlatform(compteId: string) {
    return this.listerRapprochementsCompte(FiscalRuleScope.PLATFORM, null, compteId);
  }

  // --- Logique partagée ----------------------------------------------------

  private lister(scope: FiscalRuleScope, shopId: string | null) {
    return this.prisma.tresorerieCompte.findMany({
      where: { scope, shopId, active: true },
      include: { account: { select: { code: true, label: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  private async creer(scope: FiscalRuleScope, shopId: string | null, dto: CreateTresorerieCompteDto) {
    const prefixe = PREFIXE_PAR_TYPE[dto.type];
    const existants = await this.prisma.account.count({
      where: { scope, shopId, code: { startsWith: `${prefixe}-` } },
    });
    const code = `${prefixe}-${String(existants + 1).padStart(2, "0")}`;

    const compte = await this.prisma.account.create({
      data: {
        scope,
        shopId,
        code,
        label: `${dto.type === "BANQUE" ? "Banque" : "Mobile money"} — ${dto.label}`,
        normalSide: AccountNormalSide.DEBIT,
      },
    });

    return this.prisma.tresorerieCompte.create({
      data: {
        scope,
        shopId,
        type: dto.type,
        label: dto.label,
        numero: dto.numero,
        devise: dto.devise ?? "USD",
        accountId: compte.id,
      },
      include: { account: { select: { code: true, label: true } } },
    });
  }

  private async getOwned(scope: FiscalRuleScope, shopId: string | null, compteId: string) {
    const compte = await this.prisma.tresorerieCompte.findUnique({
      where: { id: compteId },
      include: { account: { select: { code: true } } },
    });
    if (!compte) throw new NotFoundException("Compte de trésorerie introuvable.");
    if (compte.scope !== scope || compte.shopId !== shopId) {
      throw new ForbiddenException("Ce compte n'appartient pas à ce périmètre.");
    }
    return compte;
  }

  private async desactiverCompte(scope: FiscalRuleScope, shopId: string | null, compteId: string) {
    await this.getOwned(scope, shopId, compteId);
    return this.prisma.tresorerieCompte.update({ where: { id: compteId }, data: { active: false } });
  }

  private async enregistrer(
    scope: FiscalRuleScope,
    shopId: string | null,
    compteId: string,
    dto: CreateMouvementTresorerieDto,
  ) {
    const compte = await this.getOwned(scope, shopId, compteId);
    const date = dto.date ? new Date(dto.date) : new Date();
    await this.accounting.postMouvementTresorerie({
      scope,
      shopId,
      compteAccountCode: compte.account.code,
      contrepartieAccountCode: dto.contrepartieCode,
      montant: dto.montant,
      sens: dto.sens,
      label: dto.label,
      date,
      sourceId: randomUUID(),
    });
    return { statut: "comptabilise" as const };
  }

  private async creerRapprochementCompte(
    scope: FiscalRuleScope,
    shopId: string | null,
    compteId: string,
    dto: CreateRapprochementDto,
  ) {
    const compte = await this.getOwned(scope, shopId, compteId);
    const dateReleve = new Date(dto.dateReleve);
    // Borne exclusive au lendemain pour inclure toute la journée du relevé,
    // même convention que le reste du module Finance.
    const borneExclusive = new Date(dateReleve);
    borneExclusive.setUTCDate(borneExclusive.getUTCDate() + 1);

    const soldeComptable = await this.accountingQuery.soldeCompte(scope, shopId, compte.account.code, {
      lt: borneExclusive,
    });
    const ecart = Math.round((dto.soldeReleve - soldeComptable) * 100) / 100;

    return this.prisma.rapprochement.create({
      data: {
        compteId,
        dateReleve,
        soldeReleve: dto.soldeReleve,
        soldeComptable,
        ecart,
        note: dto.note,
      },
    });
  }

  private async listerRapprochementsCompte(scope: FiscalRuleScope, shopId: string | null, compteId: string) {
    await this.getOwned(scope, shopId, compteId);
    return this.prisma.rapprochement.findMany({ where: { compteId }, orderBy: { dateReleve: "desc" } });
  }
}
