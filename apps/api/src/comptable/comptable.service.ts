import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ComptableFlowCategory,
  ComptableFlowDirection,
  ComptableDebtType,
} from "@eleganz/database";
import {
  AddDebtPaymentDto,
  AddRentExpenseDto,
  CreateActivityDto,
  CreateDebtDto,
  CreateEntryDto,
  CreateRentalUnitDto,
  CreateWorkerRemittanceDto,
  QuickEntryDto,
  RecordRentPaymentDto,
} from "./dto/comptable.dto";

/**
 * ELEGANZ Mon Comptable — carnet de gestion quotidienne (prompt du
 * 13 oct. 2026). Toute vérification de propriété se fait en comparant
 * `userId` au compte authentifié, jamais à un identifiant pris dans l'URL
 * (même principe que le reste de la plateforme) : un utilisateur ne peut
 * jamais lire ou modifier les activités d'un autre, l'isolation stricte des
 * données privées étant une exigence explicite du prompt (§18).
 */
@Injectable()
export class ComptableService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Activités -----------------------------------------------------

  async createActivity(userId: string, dto: CreateActivityDto) {
    return this.prisma.comptableActivity.create({
      data: { userId, name: dto.name, category: dto.category },
    });
  }

  listActivities(userId: string) {
    return this.prisma.comptableActivity.findMany({
      where: { userId, archived: false },
      orderBy: { createdAt: "asc" },
    });
  }

  private async getOwnedActivity(userId: string, activityId: string) {
    const activity = await this.prisma.comptableActivity.findUnique({ where: { id: activityId } });
    if (!activity || activity.userId !== userId) {
      throw new NotFoundException("Activité introuvable.");
    }
    return activity;
  }

  async archiveActivity(userId: string, activityId: string) {
    await this.getOwnedActivity(userId, activityId);
    return this.prisma.comptableActivity.update({ where: { id: activityId }, data: { archived: true } });
  }

  // --- Carnet (entrées/sorties) ---------------------------------------

  async quickEntry(userId: string, dto: QuickEntryDto) {
    await this.getOwnedActivity(userId, dto.activityId);
    const date = new Date(dto.date);
    const lignes: { direction: ComptableFlowDirection; category: ComptableFlowCategory; currency: "CDF" | "USD"; amount: number }[] = [];

    if (dto.salesCdf) lignes.push({ direction: "ENTREE", category: "VENTE", currency: "CDF", amount: dto.salesCdf });
    if (dto.salesUsd) lignes.push({ direction: "ENTREE", category: "VENTE", currency: "USD", amount: dto.salesUsd });
    if (dto.expensesCdf)
      lignes.push({ direction: "SORTIE", category: "DEPENSE_FONCTIONNEMENT", currency: "CDF", amount: dto.expensesCdf });
    if (dto.expensesUsd)
      lignes.push({ direction: "SORTIE", category: "DEPENSE_FONCTIONNEMENT", currency: "USD", amount: dto.expensesUsd });

    if (lignes.length === 0) {
      throw new BadRequestException("Indiquez au moins un montant (vente ou dépense).");
    }

    return this.prisma.$transaction(
      lignes.map((ligne) =>
        this.prisma.comptableEntry.create({
          data: { activityId: dto.activityId, date, note: dto.note, ...ligne },
        }),
      ),
    );
  }

  async createEntry(userId: string, dto: CreateEntryDto) {
    await this.getOwnedActivity(userId, dto.activityId);
    return this.prisma.comptableEntry.create({
      data: {
        activityId: dto.activityId,
        date: new Date(dto.date),
        direction: dto.direction,
        category: dto.category,
        currency: dto.currency,
        amount: dto.amount,
        note: dto.note,
      },
    });
  }

  /** Saisie rétroactive et correction (prompt §5) — jamais de suppression silencieuse, on remplace la ligne. */
  async updateEntry(userId: string, entryId: string, dto: Partial<CreateEntryDto>) {
    const entry = await this.prisma.comptableEntry.findUnique({
      where: { id: entryId },
      include: { activity: true },
    });
    if (!entry || entry.activity.userId !== userId) throw new NotFoundException("Opération introuvable.");
    return this.prisma.comptableEntry.update({
      where: { id: entryId },
      data: {
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.direction !== undefined && { direction: dto.direction }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.note !== undefined && { note: dto.note }),
      },
    });
  }

  async deleteEntry(userId: string, entryId: string) {
    const entry = await this.prisma.comptableEntry.findUnique({
      where: { id: entryId },
      include: { activity: true },
    });
    if (!entry || entry.activity.userId !== userId) throw new NotFoundException("Opération introuvable.");
    return this.prisma.comptableEntry.delete({ where: { id: entryId } });
  }

  async listEntries(userId: string, activityId?: string, depuis?: string, jusqu_a?: string) {
    const activityIds = activityId
      ? [activityId]
      : (await this.prisma.comptableActivity.findMany({ where: { userId }, select: { id: true } })).map((a) => a.id);
    if (activityId) await this.getOwnedActivity(userId, activityId);

    return this.prisma.comptableEntry.findMany({
      where: {
        activityId: { in: activityIds },
        ...(depuis || jusqu_a
          ? { date: { ...(depuis && { gte: new Date(depuis) }), ...(jusqu_a && { lte: new Date(jusqu_a) }) } }
          : {}),
      },
      include: { activity: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      take: 200,
    });
  }

  // --- Dettes / créances / emprunts ------------------------------------

  async createDebt(userId: string, dto: CreateDebtDto) {
    await this.getOwnedActivity(userId, dto.activityId);
    return this.prisma.comptableDebt.create({
      data: {
        activityId: dto.activityId,
        type: dto.type,
        counterpartyName: dto.counterpartyName,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async listDebts(userId: string, activityId?: string, type?: ComptableDebtType) {
    const activityIds = activityId
      ? [activityId]
      : (await this.prisma.comptableActivity.findMany({ where: { userId }, select: { id: true } })).map((a) => a.id);
    if (activityId) await this.getOwnedActivity(userId, activityId);

    const dettes = await this.prisma.comptableDebt.findMany({
      where: { activityId: { in: activityIds }, ...(type && { type }) },
      include: { payments: true, activity: { select: { id: true, name: true } } },
      orderBy: [{ settled: "asc" }, { dueDate: "asc" }],
    });

    return dettes.map((d) => {
      const paye = d.payments.reduce((s, p) => s + Number(p.amount), 0);
      return { ...d, totalPaye: paye, solde: Math.max(Number(d.amount) - paye, 0) };
    });
  }

  private async getOwnedDebt(userId: string, debtId: string) {
    const debt = await this.prisma.comptableDebt.findUnique({
      where: { id: debtId },
      include: { activity: true, payments: true },
    });
    if (!debt || debt.activity.userId !== userId) throw new NotFoundException("Dette/créance introuvable.");
    return debt;
  }

  async addDebtPayment(userId: string, debtId: string, dto: AddDebtPaymentDto) {
    const debt = await this.getOwnedDebt(userId, debtId);
    await this.prisma.comptableDebtPayment.create({
      data: { debtId, amount: dto.amount, note: dto.note },
    });
    const totalPaye = debt.payments.reduce((s, p) => s + Number(p.amount), 0) + dto.amount;
    if (totalPaye >= Number(debt.amount)) {
      await this.prisma.comptableDebt.update({ where: { id: debtId }, data: { settled: true } });
    }
    return this.getOwnedDebt(userId, debtId);
  }

  async markDebtSettled(userId: string, debtId: string, settled: boolean) {
    await this.getOwnedDebt(userId, debtId);
    return this.prisma.comptableDebt.update({ where: { id: debtId }, data: { settled } });
  }

  // --- Gestion locative --------------------------------------------------

  async createRentalUnit(userId: string, dto: CreateRentalUnitDto) {
    await this.getOwnedActivity(userId, dto.activityId);
    return this.prisma.comptableRentalUnit.create({
      data: {
        activityId: dto.activityId,
        label: dto.label,
        location: dto.location,
        tenantName: dto.tenantName,
        rentAmount: dto.rentAmount,
        currency: dto.currency,
        frequency: dto.frequency,
        leaseStart: dto.leaseStart ? new Date(dto.leaseStart) : undefined,
        leaseEnd: dto.leaseEnd ? new Date(dto.leaseEnd) : undefined,
        depositAmount: dto.depositAmount,
      },
    });
  }

  async listRentalUnits(userId: string, activityId?: string) {
    const activityIds = activityId
      ? [activityId]
      : (await this.prisma.comptableActivity.findMany({ where: { userId }, select: { id: true } })).map((a) => a.id);
    if (activityId) await this.getOwnedActivity(userId, activityId);
    return this.prisma.comptableRentalUnit.findMany({
      where: { activityId: { in: activityIds }, active: true },
      include: { payments: { orderBy: { dueDate: "desc" }, take: 12 }, expenses: { orderBy: { date: "desc" }, take: 20 } },
      orderBy: { createdAt: "asc" },
    });
  }

  private async getOwnedRentalUnit(userId: string, unitId: string) {
    const unit = await this.prisma.comptableRentalUnit.findUnique({
      where: { id: unitId },
      include: { activity: true },
    });
    if (!unit || unit.activity.userId !== userId) throw new NotFoundException("Bien locatif introuvable.");
    return unit;
  }

  async recordRentPayment(userId: string, unitId: string, dto: RecordRentPaymentDto) {
    await this.getOwnedRentalUnit(userId, unitId);
    return this.prisma.comptableRentPayment.create({
      data: {
        unitId,
        periodLabel: dto.periodLabel,
        expectedAmount: dto.expectedAmount,
        receivedAmount: dto.receivedAmount,
        dueDate: new Date(dto.dueDate),
        paidAt: dto.receivedAmount >= dto.expectedAmount ? new Date() : undefined,
        note: dto.note,
      },
    });
  }

  async addRentExpense(userId: string, unitId: string, dto: AddRentExpenseDto) {
    await this.getOwnedRentalUnit(userId, unitId);
    return this.prisma.comptableRentExpense.create({
      data: { unitId, category: dto.category, amount: dto.amount, currency: dto.currency, note: dto.note },
    });
  }

  // --- Versements des travailleurs ---------------------------------------

  async createWorkerRemittance(userId: string, dto: CreateWorkerRemittanceDto) {
    await this.getOwnedActivity(userId, dto.activityId);
    return this.prisma.comptableWorkerRemittance.create({
      data: {
        activityId: dto.activityId,
        workerName: dto.workerName,
        periodLabel: dto.periodLabel,
        expectedAmount: dto.expectedAmount,
        declaredRevenue: dto.declaredRevenue,
        declaredExpenses: dto.declaredExpenses,
        paidAmount: dto.paidAmount,
        currency: dto.currency,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        note: dto.note,
      },
    });
  }

  async listWorkerRemittances(userId: string, activityId?: string) {
    const activityIds = activityId
      ? [activityId]
      : (await this.prisma.comptableActivity.findMany({ where: { userId }, select: { id: true } })).map((a) => a.id);
    if (activityId) await this.getOwnedActivity(userId, activityId);
    return this.prisma.comptableWorkerRemittance.findMany({
      where: { activityId: { in: activityIds } },
      orderBy: { createdAt: "desc" },
    });
  }

  async markRemittanceSettled(userId: string, remittanceId: string) {
    const remittance = await this.prisma.comptableWorkerRemittance.findUnique({
      where: { id: remittanceId },
      include: { activity: true },
    });
    if (!remittance || remittance.activity.userId !== userId) {
      throw new NotFoundException("Versement introuvable.");
    }
    return this.prisma.comptableWorkerRemittance.update({
      where: { id: remittanceId },
      data: { settledAt: new Date() },
    });
  }

  // --- « Mon activité en chiffres » : tableau de bord ---------------------

  /**
   * Agrège les vrais montants enregistrés, jamais de données inventées
   * (prompt §10.4). Les totaux restent séparés par devise (prompt §5) — on
   * ne fusionne jamais CDF et USD dans un même chiffre.
   */
  async dashboard(userId: string) {
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId, archived: false } });
    const activityIds = activites.map((a) => a.id);

    const maintenant = new Date();
    const debutJour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    const debutSemaine = new Date(debutJour);
    debutSemaine.setDate(debutSemaine.getDate() - debutSemaine.getDay());
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
    const debutAnnee = new Date(maintenant.getFullYear(), 0, 1);

    const entries = await this.prisma.comptableEntry.findMany({
      where: { activityId: { in: activityIds }, date: { gte: debutAnnee } },
    });

    function totaux(depuis: Date) {
      const sousSet = entries.filter((e) => e.date >= depuis);
      const parDevise = (direction: ComptableFlowDirection, currency: "CDF" | "USD") =>
        sousSet
          .filter((e) => e.direction === direction && e.currency === currency)
          .reduce((s, e) => s + Number(e.amount), 0);
      return {
        ventesCdf: parDevise("ENTREE", "CDF"),
        ventesUsd: parDevise("ENTREE", "USD"),
        depensesCdf: parDevise("SORTIE", "CDF"),
        depensesUsd: parDevise("SORTIE", "USD"),
      };
    }

    const [dettes, creances, emprunts] = await Promise.all(
      (["DETTE", "CREANCE", "EMPRUNT"] as const).map((type) =>
        this.prisma.comptableDebt.findMany({
          where: { activityId: { in: activityIds }, type, settled: false },
          include: { payments: true },
        }),
      ),
    );

    function soldesParDevise(liste: typeof dettes) {
      const parDevise: Record<string, number> = {};
      for (const d of liste) {
        const paye = d.payments.reduce((s, p) => s + Number(p.amount), 0);
        const solde = Math.max(Number(d.amount) - paye, 0);
        parDevise[d.currency] = (parDevise[d.currency] ?? 0) + solde;
      }
      return parDevise;
    }

    return {
      activites: activites.length,
      jour: totaux(debutJour),
      semaine: totaux(debutSemaine),
      mois: totaux(debutMois),
      annee: totaux(debutAnnee),
      dettesRestantes: soldesParDevise(dettes),
      creancesRestantes: soldesParDevise(creances),
      empruntsRestants: soldesParDevise(emprunts),
      nombreDettesEnCours: dettes.length,
      nombreCreancesEnCours: creances.length,
    };
  }

  /**
   * Historique journalier (prompt §10.3, graphiques) — les N derniers jours,
   * ventes et dépenses par devise, pour tracer une courbe d'évolution. Jamais
   * de point inventé pour un jour sans saisie : le jour apparaît avec des
   * montants à zéro, ce qui est la vérité (pas d'opération ce jour-là).
   */
  async dashboardHistorique(userId: string, jours = 14) {
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId, archived: false } });
    const activityIds = activites.map((a) => a.id);
    const nbJours = Math.min(Math.max(jours, 7), 60);
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    debut.setDate(debut.getDate() - (nbJours - 1));

    const entries = await this.prisma.comptableEntry.findMany({
      where: { activityId: { in: activityIds }, date: { gte: debut } },
    });

    const jours_: { date: string; ventesCdf: number; ventesUsd: number; depensesCdf: number; depensesUsd: number }[] = [];
    for (let i = 0; i < nbJours; i++) {
      const jour = new Date(debut);
      jour.setDate(jour.getDate() + i);
      const lendemain = new Date(jour);
      lendemain.setDate(lendemain.getDate() + 1);
      const duJour = entries.filter((e) => e.date >= jour && e.date < lendemain);
      const somme = (direction: ComptableFlowDirection, currency: "CDF" | "USD") =>
        duJour.filter((e) => e.direction === direction && e.currency === currency).reduce((s, e) => s + Number(e.amount), 0);
      jours_.push({
        date: jour.toISOString().slice(0, 10),
        ventesCdf: somme("ENTREE", "CDF"),
        ventesUsd: somme("ENTREE", "USD"),
        depensesCdf: somme("SORTIE", "CDF"),
        depensesUsd: somme("SORTIE", "USD"),
      });
    }
    return jours_;
  }

  /**
   * Comparaison entre activités sur le mois civil en cours (prompt §10.3) —
   * résultat net (ventes - dépenses) par activité et par devise, pour un
   * classement visuel. Les résultats de deux activités ne sont jamais
   * fusionnés en un seul chiffre composite (prompt §2) : chaque activité
   * garde sa propre ligne.
   */
  async dashboardComparaison(userId: string) {
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId, archived: false } });
    const debutMois = new Date();
    debutMois.setDate(1);
    debutMois.setHours(0, 0, 0, 0);

    const resultats = await Promise.all(
      activites.map(async (a) => {
        const entries = await this.prisma.comptableEntry.findMany({
          where: { activityId: a.id, date: { gte: debutMois } },
        });
        const somme = (direction: ComptableFlowDirection, currency: "CDF" | "USD") =>
          entries.filter((e) => e.direction === direction && e.currency === currency).reduce((s, e) => s + Number(e.amount), 0);
        return {
          activityId: a.id,
          activityName: a.name,
          resultatCdf: somme("ENTREE", "CDF") - somme("SORTIE", "CDF"),
          resultatUsd: somme("ENTREE", "USD") - somme("SORTIE", "USD"),
        };
      }),
    );
    return resultats;
  }

  /**
   * Rappels priorisés pour la page d'accueil (prompt §12), calculés à
   * l'ouverture à partir des données réellement enregistrées — aucune
   * notification externe, aucun envoi périodique (prompt §11).
   */
  async reminders(userId: string) {
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId, archived: false } });
    const activityIds = activites.map((a) => a.id);
    const maintenant = new Date();
    const dansSeptJours = new Date(maintenant.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dettesOuvertes = await this.prisma.comptableDebt.findMany({
      where: { activityId: { in: activityIds }, settled: false, type: { in: ["DETTE", "EMPRUNT"] } },
      include: { activity: { select: { name: true } } },
    });
    const creancesOuvertes = await this.prisma.comptableDebt.findMany({
      where: { activityId: { in: activityIds }, settled: false, type: "CREANCE" },
      include: { activity: { select: { name: true } } },
    });
    const impayesLoyers = await this.prisma.comptableRentPayment.findMany({
      where: { unit: { activityId: { in: activityIds } }, paidAt: null },
      include: { unit: { select: { label: true } } },
    });
    const versementsOuverts = await this.prisma.comptableWorkerRemittance.findMany({
      where: { activityId: { in: activityIds }, settledAt: null },
      include: { activity: { select: { name: true } } },
    });

    const urgents: { label: string; detail: string; refType: string; refId: string }[] = [];
    const aVenir: { label: string; detail: string; refType: string; refId: string }[] = [];

    for (const d of dettesOuvertes) {
      if (!d.dueDate) continue;
      const libelle = d.type === "EMPRUNT" ? "Emprunt" : "Dette";
      if (d.dueDate <= maintenant) {
        urgents.push({ label: `${libelle} échue — ${d.counterpartyName}`, detail: d.activity.name, refType: "debt", refId: d.id });
      } else if (d.dueDate <= dansSeptJours) {
        aVenir.push({ label: `${libelle} à payer bientôt — ${d.counterpartyName}`, detail: d.activity.name, refType: "debt", refId: d.id });
      }
    }
    for (const c of creancesOuvertes) {
      if (c.dueDate && c.dueDate <= dansSeptJours) {
        aVenir.push({ label: `Créance attendue — ${c.counterpartyName}`, detail: c.activity.name, refType: "debt", refId: c.id });
      }
    }
    for (const r of impayesLoyers) {
      const texte = `Loyer impayé — ${r.unit.label} (${r.periodLabel})`;
      if (r.dueDate <= maintenant) {
        urgents.push({ label: texte, detail: "", refType: "rent", refId: r.id });
      } else if (r.dueDate <= dansSeptJours) {
        aVenir.push({ label: `Loyer bientôt exigible — ${r.unit.label} (${r.periodLabel})`, detail: "", refType: "rent", refId: r.id });
      }
    }
    for (const v of versementsOuverts) {
      if (v.dueDate && v.dueDate <= maintenant) {
        urgents.push({ label: `Versement attendu — ${v.workerName}`, detail: v.activity.name, refType: "remittance", refId: v.id });
      }
    }

    const infos: { label: string; detail: string }[] = [];
    for (const a of activites) {
      const derniere = await this.prisma.comptableEntry.findFirst({
        where: { activityId: a.id },
        orderBy: { date: "desc" },
      });
      if (!derniere) {
        infos.push({ label: `Aucune saisie enregistrée`, detail: a.name });
        continue;
      }
      const joursEcoules = (maintenant.getTime() - derniere.date.getTime()) / (24 * 60 * 60 * 1000);
      if (joursEcoules > 7) {
        infos.push({ label: `Pas de saisie depuis ${Math.floor(joursEcoules)} jours`, detail: a.name });
      }
    }

    const subscription = await this.getOrCreateSubscription(userId);
    if (subscription.billingStatus === "FREE_PERIOD") {
      infos.push({ label: "Période gratuite en cours", detail: "Voir l'abonnement" });
    } else if (subscription.billingStatus === "PAYMENT_DUE") {
      urgents.push({ label: "Abonnement à régulariser", detail: "Mon Comptable", refType: "subscription", refId: subscription.id });
    }

    return { urgents, aVenir, infos };
  }

  /**
   * Agenda personnel (prompt §13) — liste chronologique des échéances
   * réelles (dettes/créances/emprunts, loyers attendus, versements de
   * travailleurs), jamais générée, jamais inventée. Fenêtre large (passé
   * proche + 90 jours à venir) pour couvrir vue chronologique et vue
   * calendrier côté écran sans multiplier les appels.
   */
  async agenda(userId: string) {
    const activites = await this.prisma.comptableActivity.findMany({ where: { userId, archived: false } });
    const activityIds = activites.map((a) => a.id);
    const maintenant = new Date();
    const borneBasse = new Date(maintenant.getTime() - 30 * 24 * 60 * 60 * 1000);
    const borneHaute = new Date(maintenant.getTime() + 90 * 24 * 60 * 60 * 1000);

    type Evenement = { date: string; label: string; detail: string; type: "dette" | "creance" | "emprunt" | "loyer" | "versement"; refId: string };
    const evenements: Evenement[] = [];

    const dettesEtCreances = await this.prisma.comptableDebt.findMany({
      where: {
        activityId: { in: activityIds },
        settled: false,
        dueDate: { gte: borneBasse, lte: borneHaute },
      },
      include: { activity: { select: { name: true } } },
    });
    for (const d of dettesEtCreances) {
      if (!d.dueDate) continue;
      const type = d.type === "CREANCE" ? "creance" : d.type === "EMPRUNT" ? "emprunt" : "dette";
      const libelle = d.type === "CREANCE" ? "Créance attendue" : d.type === "EMPRUNT" ? "Emprunt à rembourser" : "Dette à payer";
      evenements.push({
        date: d.dueDate.toISOString(),
        label: `${libelle} — ${d.counterpartyName}`,
        detail: d.activity.name,
        type,
        refId: d.id,
      });
    }

    const loyers = await this.prisma.comptableRentPayment.findMany({
      where: {
        unit: { activityId: { in: activityIds } },
        paidAt: null,
        dueDate: { gte: borneBasse, lte: borneHaute },
      },
      include: { unit: { select: { label: true, activity: { select: { name: true } } } } },
    });
    for (const l of loyers) {
      evenements.push({
        date: l.dueDate.toISOString(),
        label: `Loyer attendu — ${l.unit.label} (${l.periodLabel})`,
        detail: l.unit.activity.name,
        type: "loyer",
        refId: l.id,
      });
    }

    const versements = await this.prisma.comptableWorkerRemittance.findMany({
      where: {
        activityId: { in: activityIds },
        settledAt: null,
        dueDate: { gte: borneBasse, lte: borneHaute },
      },
      include: { activity: { select: { name: true } } },
    });
    for (const v of versements) {
      if (!v.dueDate) continue;
      evenements.push({
        date: v.dueDate.toISOString(),
        label: `Versement attendu — ${v.workerName}`,
        detail: v.activity.name,
        type: "versement",
        refId: v.id,
      });
    }

    evenements.sort((a, b) => a.date.localeCompare(b.date));
    return evenements;
  }

  // --- Abonnement Mon Comptable -------------------------------------------

  /** Activation effective = premier appel authentifié à l'espace Mon Comptable (prompt §14). */
  async getOrCreateSubscription(userId: string) {
    const existant = await this.prisma.comptableSubscription.findUnique({ where: { userId } });
    if (existant) return existant;
    return this.prisma.comptableSubscription.create({ data: { userId } });
  }

  async choosePlan(userId: string, plan: "MONTHLY" | "YEARLY") {
    const subscription = await this.getOrCreateSubscription(userId);
    return this.prisma.comptableSubscription.update({ where: { id: subscription.id }, data: { plan } });
  }
}
