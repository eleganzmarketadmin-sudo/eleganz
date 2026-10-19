import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { BusinessPlanService } from "./business-plan.service";
import { CreateLoanDto } from "./dto/loan.dto";
import { FiscalRuleScope, LoanStatut } from "@eleganz/database";

function debutDuMois(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

export type StatutEcheance = "comptabilisee" | "deja_comptabilisee" | "termine";

/**
 * Prêts réellement obtenus (19 oct. 2026 — demande du 19 oct. 2026 : "si on
 * obtient un financement pour ELEGANZ, comment est-ce que cela sera géré ?").
 * Distinct de LoanScenario (BusinessPlanService), purement simulatif pour le
 * dossier crédit : un Loan est un prêt effectivement décaissé, comptabilisé,
 * avec un solde réel qui diminue à chaque échéance. Même pattern
 * scope/shopId + méthodes "ForShop"/"ForPlatform" que
 * FiscalRulesService/AssetsService/TresorerieComptesService/ExpensesService.
 *
 * L'amortissement est calculé sur le SOLDE RESTANT réel (dégressif), pas
 * sur l'échéancier théorique figé au moment de l'obtention — un
 * remboursement en retard ou anticipé reste donc toujours cohérent avec le
 * solde effectivement comptabilisé.
 */
@Injectable()
export class LoansService {
  // BusinessPlanService n'est jamais injecté : seule sa méthode statique
  // `mensualite` est réutilisée ci-dessous (même formule que l'échéancier
  // affiché dans le dossier crédit), sans dépendance d'instance.
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async create(shopId: string, dto: CreateLoanDto) {
    return this.obtenirPret(FiscalRuleScope.SHOP, shopId, dto);
  }

  listForShop(shopId: string) {
    return this.lister(FiscalRuleScope.SHOP, shopId);
  }

  async comptabiliserEcheance(shopId: string, loanId: string, periode?: string) {
    return this.comptabiliser(FiscalRuleScope.SHOP, shopId, loanId, periode);
  }

  async listerEcheances(shopId: string, loanId: string) {
    return this.echeances(FiscalRuleScope.SHOP, shopId, loanId);
  }

  // --- ELEGANZ elle-même (scope=PLATFORM) --------------------------------

  async createForPlatform(dto: CreateLoanDto) {
    return this.obtenirPret(FiscalRuleScope.PLATFORM, null, dto);
  }

  listForPlatform() {
    return this.lister(FiscalRuleScope.PLATFORM, null);
  }

  async comptabiliserEcheanceForPlatform(loanId: string, periode?: string) {
    return this.comptabiliser(FiscalRuleScope.PLATFORM, null, loanId, periode);
  }

  async listerEcheancesForPlatform(loanId: string) {
    return this.echeances(FiscalRuleScope.PLATFORM, null, loanId);
  }

  // --- Logique partagée ----------------------------------------------------

  private serialiser(loan: { montant: unknown; tauxAnnuel: unknown; soldeRestant: unknown; [k: string]: unknown }) {
    return {
      ...loan,
      montant: Number(loan.montant),
      tauxAnnuel: Number(loan.tauxAnnuel),
      soldeRestant: Number(loan.soldeRestant),
    };
  }

  private lister(scope: FiscalRuleScope, shopId: string | null) {
    return this.prisma.loan
      .findMany({ where: { scope, shopId }, orderBy: { dateObtention: "desc" } })
      .then((loans) => loans.map((l) => this.serialiser(l)));
  }

  /**
   * Comptabilise immédiatement le décaissement (jamais une simple
   * déclaration non comptabilisée — ce serait présenter comme obtenu un
   * financement qui ne bougerait jamais la trésorerie réelle). Si
   * `scenarioId` référence un scénario existant du business plan, ses
   * montant/taux/durée sont repris par défaut (toujours surchageables par
   * le formulaire) pour qu'un prêt obtenu reste traçable jusqu'à
   * l'hypothèse qui l'a précédé.
   */
  private async obtenirPret(scope: FiscalRuleScope, shopId: string | null, dto: CreateLoanDto) {
    const loan = await this.prisma.loan.create({
      data: {
        scope,
        shopId,
        label: dto.label,
        scenarioId: dto.scenarioId,
        montant: dto.montant,
        tauxAnnuel: dto.tauxAnnuel,
        dureeMois: dto.dureeMois,
        devise: dto.devise ?? "USD",
        compteAccountCode: dto.compteAccountCode,
        dateObtention: dto.dateObtention ? new Date(dto.dateObtention) : new Date(),
        soldeRestant: dto.montant,
      },
    });

    await this.accounting.postLoanDisbursement({
      id: loan.id,
      scope,
      shopId,
      montant: loan.montant,
      compteAccountCode: loan.compteAccountCode,
      label: loan.label,
    });

    return this.serialiser(loan);
  }

  private async getOwned(scope: FiscalRuleScope, shopId: string | null, loanId: string) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException("Prêt introuvable.");
    if (loan.scope !== scope || loan.shopId !== shopId) {
      throw new ForbiddenException("Ce prêt n'appartient pas à ce périmètre.");
    }
    return loan;
  }

  /**
   * Comptabilise l'échéance du mois `periode` (AAAA-MM, mois courant par
   * défaut) : mensualité constante (BusinessPlanService.mensualite),
   * intérêt calculé sur le solde restant réel, capital = mensualité -
   * intérêt (jamais l'inverse, pour que la dernière échéance absorbe
   * toujours l'arrondi plutôt que de laisser un solde résiduel de quelques
   * centimes). Idempotent par mois (contrainte d'unicité
   * [loanId, periodDate]) — même garde-fou que AssetsService, écriture
   * posée AVANT la ligne de déduplication.
   */
  private async comptabiliser(scope: FiscalRuleScope, shopId: string | null, loanId: string, periode?: string) {
    const loan = await this.getOwned(scope, shopId, loanId);
    if (loan.statut === LoanStatut.TERMINE) {
      return { loanId, statut: "termine" as StatutEcheance, capital: 0, interet: 0 };
    }

    const periodDate = periode ? debutDuMois(new Date(`${periode}-01T00:00:00.000Z`)) : debutDuMois(new Date());
    const dejaExistante = await this.prisma.loanInstallment.findFirst({
      where: { loanId, periodDate },
    });
    if (dejaExistante) {
      return {
        loanId,
        statut: "deja_comptabilisee" as StatutEcheance,
        capital: Number(dejaExistante.capital),
        interet: Number(dejaExistante.interet),
      };
    }

    const soldeRestant = Number(loan.soldeRestant);
    const tauxMensuel = Number(loan.tauxAnnuel) / 100 / 12;
    const mensualite = BusinessPlanService.mensualite(Number(loan.montant), Number(loan.tauxAnnuel), loan.dureeMois);
    const interet = Math.round(soldeRestant * tauxMensuel * 100) / 100;
    // Dernière échéance (ou mensualité théorique qui dépasserait le solde
    // restant, ex. remboursement anticipé déjà fait manuellement) : le
    // capital absorbe tout le solde restant plutôt que de laisser un
    // résidu de quelques centimes ou de générer un solde négatif.
    const capitalTheorique = Math.max(mensualite - interet, 0);
    const capital = Math.min(Math.round(capitalTheorique * 100) / 100, soldeRestant);
    const nouveauSolde = Math.max(Math.round((soldeRestant - capital) * 100) / 100, 0);

    // L'écriture comptable est posée AVANT la ligne de déduplication (pas
    // l'inverse) — même ordre défensif que AssetsService.comptabiliserDotations
    // : si postLoanInstallment échoue (période clôturée, ou toute autre
    // erreur), aucune ligne LoanInstallment n'est créée et un nouvel essai
    // reste possible, sans jamais recalculer un intérêt différent pour le
    // même mois sur un solde qui n'aurait en réalité pas changé. L'id est
    // généré côté serveur pour servir de sourceId à l'écriture avant même
    // que la ligne LoanInstallment existe.
    const installmentId = randomUUID();
    await this.accounting.postLoanInstallment({
      installmentId,
      scope,
      shopId,
      compteAccountCode: loan.compteAccountCode,
      capital,
      interet,
      label: `Échéance prêt — ${loan.label} (${periodDate.toISOString().slice(0, 7)})`,
      periodDate,
    });

    await this.prisma.loanInstallment.create({
      data: { id: installmentId, loanId, periodDate, capital, interet },
    });

    await this.prisma.loan.update({
      where: { id: loanId },
      data: {
        soldeRestant: nouveauSolde,
        statut: nouveauSolde <= 0 ? LoanStatut.TERMINE : LoanStatut.ACTIF,
      },
    });

    return { loanId, statut: "comptabilisee" as StatutEcheance, capital, interet };
  }

  private async echeances(scope: FiscalRuleScope, shopId: string | null, loanId: string) {
    await this.getOwned(scope, shopId, loanId);
    const lignes = await this.prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { periodDate: "desc" },
    });
    return lignes.map((l) => ({ ...l, capital: Number(l.capital), interet: Number(l.interet) }));
  }
}
