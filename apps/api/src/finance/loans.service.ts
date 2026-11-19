import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AccountingService } from "./accounting.service";
import { BusinessPlanService } from "./business-plan.service";
import { CreateLoanDto } from "./dto/loan.dto";
import { DemandeCreditStatut, FiscalRuleScope, LoanDecisionStatut, LoanStatut } from "@eleganz/database";

// Délai de paiement par défaut de la facture de commission institution
// (19 nov. 2026, décision du propriétaire : 15 jours à compter du
// décaissement du prêt — voir InstitutionInvoice dans schema.prisma).
const DELAI_PAIEMENT_FACTURE_INSTITUTION_JOURS = 15;

function debutDuMois(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
}

// Chantier "gestion de risque autonome" (16 nov. 2026) — voir le commentaire
// sur Loan.prochainEcheanceAttendueLe dans schema.prisma : seule base dont
// RisqueCreditService dérive joursRetardActuel/classificationRisque/
// provisionRequise, jamais un échéancier théorique recalculé à chaque fois.
function ajouterUnMois(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
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
  private readonly logger = new Logger(LoansService.name);

  // BusinessPlanService n'est jamais injecté : seule sa méthode statique
  // `mensualite` est réutilisée ci-dessous (même formule que l'échéancier
  // affiché dans le dossier crédit), sans dépendance d'instance.
  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  // --- Boutique (scope=SHOP) ---------------------------------------------

  async create(shopId: string, dto: CreateLoanDto) {
    // Décaissement issu d'une décision du portail institutions (14 nov.
    // 2026) — voir `obtenirPretViaDecision` : la boutique garde la main sur
    // le compte de trésorerie qui reçoit les fonds (`compteAccountCode`,
    // une information que l'institution n'a pas), mais montant/taux/durée
    // viennent de la décision déjà prise, jamais resaisis ici.
    if (dto.decisionId) {
      return this.obtenirPretViaDecision(shopId, dto.decisionId, dto);
    }
    return this.obtenirPret(FiscalRuleScope.SHOP, shopId, dto);
  }

  // --- Portail institutions (14 nov. 2026) --------------------------------

  private async obtenirPretViaDecision(shopId: string, decisionId: string, dto: CreateLoanDto) {
    const decision = await this.prisma.loanDecision.findUnique({ where: { id: decisionId } });
    if (!decision || decision.shopId !== shopId) {
      throw new NotFoundException("Décision introuvable pour cette boutique.");
    }
    if (decision.statut !== LoanDecisionStatut.ACCORDE) {
      throw new BadRequestException(
        "Cette décision n'est pas un accord — aucun prêt ne peut être décaissé à partir d'elle.",
      );
    }
    if (decision.loanId) {
      throw new BadRequestException("Cette décision a déjà donné lieu à un décaissement.");
    }

    // Commission ELEGANZ (configurable/désactivable depuis le Centre de
    // pilotage, voir PlatformSettings.institutionLoanCommissionRateDefault)
    // — figée au décaissement, comme la commission marketplace
    // (OrdersService) : le taux facturé reste celui en vigueur à ce
    // moment-là, même si l'admin le change ensuite. Plancher/plafond ajoutés
    // le 14 nov. 2026 ("1% du montant avec un minimum de 100 $ et un maximum
    // de 1000 $") : chacun optionnel et indépendant — un seuil non renseigné
    // ne s'applique simplement pas.
    const platformSettings = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: {
        institutionLoanCommissionRateDefault: true,
        institutionLoanCommissionMinAmount: true,
        institutionLoanCommissionMaxAmount: true,
      },
    });
    const taux = platformSettings?.institutionLoanCommissionRateDefault
      ? Number(platformSettings.institutionLoanCommissionRateDefault)
      : 0;
    const montant = Number(decision.montant);
    let institutionCommissionAmount: number | null = taux > 0 ? Math.round(montant * (taux / 100) * 100) / 100 : null;
    if (institutionCommissionAmount !== null) {
      if (platformSettings?.institutionLoanCommissionMinAmount != null) {
        institutionCommissionAmount = Math.max(institutionCommissionAmount, Number(platformSettings.institutionLoanCommissionMinAmount));
      }
      if (platformSettings?.institutionLoanCommissionMaxAmount != null) {
        institutionCommissionAmount = Math.min(institutionCommissionAmount, Number(platformSettings.institutionLoanCommissionMaxAmount));
      }
    }

    const dateObtentionPret = dto.dateObtention ? new Date(dto.dateObtention) : new Date();
    const loan = await this.prisma.loan.create({
      data: {
        scope: FiscalRuleScope.SHOP,
        shopId,
        label: dto.label,
        scenarioId: decision.scenarioId,
        montant: decision.montant,
        tauxAnnuel: decision.tauxAnnuel,
        dureeMois: decision.dureeMois,
        devise: dto.devise ?? "USD",
        compteAccountCode: dto.compteAccountCode,
        dateObtention: dateObtentionPret,
        soldeRestant: decision.montant,
        institutionId: decision.institutionId,
        institutionCommissionAmount,
        suiviRemboursementParInstitution: decision.autoriserSuiviRemboursement,
        // Première échéance attendue dans 1 mois (chantier "gestion de
        // risque autonome", 16 nov. 2026) — voir ajouterUnMois ci-dessus.
        prochainEcheanceAttendueLe: ajouterUnMois(dateObtentionPret),
      },
    });

    await this.accounting.postLoanDisbursement({
      id: loan.id,
      scope: FiscalRuleScope.SHOP,
      shopId,
      montant: loan.montant,
      compteAccountCode: loan.compteAccountCode,
      label: loan.label,
    });

    // Facture de commission à l'institution (19 nov. 2026, demande du
    // propriétaire : ces commissions doivent figurer dans l'écran Factures,
    // pas dans Finance) — une seule par prêt, créée ici au décaissement,
    // jamais comptabilisée tout de suite (le revenu n'est reconnu qu'au
    // règlement effectif, voir markInstitutionInvoicePaid ci-dessous, même
    // principe que BillingService.markInvoicePaidAndReactivate).
    if (institutionCommissionAmount !== null && institutionCommissionAmount > 0 && decision.institutionId) {
      const dueAt = new Date(dateObtentionPret);
      dueAt.setDate(dueAt.getDate() + DELAI_PAIEMENT_FACTURE_INSTITUTION_JOURS);
      await this.prisma.institutionInvoice.create({
        data: {
          institutionId: decision.institutionId,
          loanId: loan.id,
          amount: institutionCommissionAmount,
          devise: dto.devise ?? "USD",
          dueAt,
        },
      });
    }

    await this.prisma.loanDecision.update({ where: { id: decisionId }, data: { loanId: loan.id } });

    // Raccroche au cycle de vie de la DemandeCredit d'origine (16 nov.
    // 2026), quand cette décision en découle — petit hook, LoansService ne
    // connaît rien d'autre de DemandeCredit. `decision` ci-dessus n'a pas de
    // `select` explicite, donc `demandeCreditId` y figure déjà.
    if (decision.demandeCreditId) {
      await this.prisma.demandeCredit.update({
        where: { id: decision.demandeCreditId },
        data: { statut: DemandeCreditStatut.DECAISSEE },
      });
    }

    return this.serialiser(loan);
  }

  /** Prêts décaissés via le portail d'une institution donnée. */
  // Inclut le nom de la boutique (contrairement à listForShop/listForPlatform,
  // où le périmètre est déjà connu de l'appelant) : le portail institution
  // couvre potentiellement plusieurs boutiques à la fois, donc chaque ligne
  // doit se suffire à elle-même pour l'affichage (14 nov. 2026).
  listForInstitution(institutionId: string) {
    return this.prisma.loan
      .findMany({
        where: { institutionId },
        include: { shop: { select: { id: true, name: true, slug: true } } },
        orderBy: { dateObtention: "desc" },
      })
      .then((loans) => loans.map((l) => this.serialiser(l)));
  }

  /**
   * Comptabiliser une échéance depuis le portail institution — seulement
   * pour un prêt que CETTE institution a elle-même décaissé ET dont la
   * boutique/l'institution a activé le suivi délégué
   * (`suiviRemboursementParInstitution`, demande du 14 nov. 2026 : "suivi
   * des remboursements optionnel"). Sinon, la saisie manuelle existante par
   * la boutique/l'admin reste la seule voie — jamais remplacée, seulement
   * complétée.
   */
  async comptabiliserEcheanceViaInstitution(institutionId: string, shopId: string, loanId: string, periode?: string) {
    const loan = await this.getOwned(FiscalRuleScope.SHOP, shopId, loanId);
    if (loan.institutionId !== institutionId || !loan.suiviRemboursementParInstitution) {
      throw new ForbiddenException("Cette institution n'est pas autorisée à comptabiliser les échéances de ce prêt.");
    }
    return this.comptabiliser(FiscalRuleScope.SHOP, shopId, loanId, periode);
  }

  async listerEcheancesViaInstitution(institutionId: string, shopId: string, loanId: string) {
    const loan = await this.getOwned(FiscalRuleScope.SHOP, shopId, loanId);
    if (loan.institutionId !== institutionId) {
      throw new ForbiddenException("Ce prêt n'appartient pas à cette institution.");
    }
    return this.echeances(FiscalRuleScope.SHOP, shopId, loanId);
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
        // Avance la prochaine échéance attendue d'exactement 1 mois pour
        // CHAQUE échéance comptabilisée (chantier "gestion de risque
        // autonome", 16 nov. 2026) — jamais remise à "aujourd'hui + 1 mois",
        // pour qu'un rattrapage mois par mois sur un arriéré reste visible
        // tant que tous les mois dus n'ont pas été comptabilisés. Ne
        // s'applique qu'aux prêts qui en ont déjà une (décaissés via une
        // institution, voir obtenirPretViaDecision) — reste null sinon,
        // ignoré par RisqueCreditService.
        ...(loan.prochainEcheanceAttendueLe ? { prochainEcheanceAttendueLe: ajouterUnMois(periodDate) } : {}),
      },
    });

    // Raccroche au cycle de vie de la DemandeCredit d'origine (16 nov.
    // 2026) — seuls les prêts décaissés via une institution peuvent en
    // avoir une (voir obtenirPretViaDecision ci-dessus), d'où le filtre sur
    // loan.institutionId avant d'interroger LoanDecision.
    if (loan.institutionId) {
      await this.majStatutDemandeCredit(loanId, nouveauSolde <= 0 ? DemandeCreditStatut.SOLDEE : DemandeCreditStatut.EN_REMBOURSEMENT);
    }

    return { loanId, statut: "comptabilisee" as StatutEcheance, capital, interet };
  }

  private async majStatutDemandeCredit(loanId: string, statut: DemandeCreditStatut) {
    const decision = await this.prisma.loanDecision.findUnique({ where: { loanId }, select: { demandeCreditId: true } });
    if (decision?.demandeCreditId) {
      await this.prisma.demandeCredit.update({ where: { id: decision.demandeCreditId }, data: { statut } });
    }
  }

  // --- Factures de commission institution (19 nov. 2026) — voir
  // InstitutionInvoice dans schema.prisma et obtenirPretViaDecision
  // ci-dessus pour leur création. Consultées/réglées depuis l'écran admin
  // Factures (MenuAdmin.FACTURES, voir BillingController), jamais depuis
  // Finance : seule la vue PLATEFORME (toutes institutions confondues) a un
  // sens ici, pas de variante "ForShop"/"ForInstitution" comme le reste de
  // ce service. -------------------------------------------------------------

  listInstitutionInvoices() {
    return this.prisma.institutionInvoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        institution: { select: { id: true, name: true } },
        loan: { select: { id: true, label: true, shop: { select: { id: true, name: true } } } },
      },
    });
  }

  /**
   * Marque une facture de commission institution payée (virement reçu,
   * constaté manuellement par un admin — aucun moteur de relances/pénalité/
   * suspension ici, décision explicite du propriétaire : une institution
   * est un partenaire financier, pas une boutique sous contrat de
   * facturation). Revenu ELEGANZ reconnu au règlement effectif, jamais à la
   * facturation (même principe que BillingService.markInvoicePaidAndReactivate).
   */
  async markInstitutionInvoicePaid(invoiceId: string, adminUserId: string) {
    const invoice = await this.prisma.institutionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
    if (invoice.status === "PAID") {
      throw new BadRequestException("Cette facture est déjà marquée payée.");
    }
    const paidAt = new Date();
    const factureMaj = await this.prisma.institutionInvoice.update({
      where: { id: invoiceId },
      data: { status: "PAID", paidAt, paidByUserId: adminUserId },
    });

    await this.accounting
      .postPlatformInvoicePaid({ id: factureMaj.id, amount: Number(invoice.amount) }, "institutionInvoice")
      .catch((err) => {
        this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la facture institution ${invoiceId} échouée`, err);
      });

    return factureMaj;
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
