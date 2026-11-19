import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { PaymentMethod, StockMovementType } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
  ) {}

  /**
   * Vente de caisse transactionnelle : décompte du stock et enregistrement de
   * la vente se font dans la même transaction DB, pour empêcher la double
   * vente décrite dans le complément stratégique (§5) — une commande en ligne
   * concurrente sur le même article ne peut pas vendre un stock déjà écoulé
   * en caisse, et inversement.
   *
   * `allowNegativeStock` sert exclusivement à la synchronisation hors-ligne
   * (voir `syncOfflineSale` ci-dessous et docs/ARCHITECTURE_HORS_LIGNE.md) :
   * une vente en direct reste bloquée par un stock insuffisant (la caissière
   * peut regarder l'étagère), mais une vente synchronisée après coup
   * correspond à de l'argent déjà réellement encaissé pendant une coupure —
   * on ne l'efface jamais, on signale l'écart (`stockDiscrepancy`) pour que
   * la boutique régularise elle-même. Décision validée par le propriétaire.
   */
  async createSale(
    shopId: string,
    dto: CreateSaleDto & { cashierId: string; clientOperationId?: string },
    options: { allowNegativeStock?: boolean } = {},
  ) {
    // Résolution du client encaissé (19 nov. 2026, demande : "ajouter à la
    // facture... identité du client et son numéro phone whatsapp") — la
    // caisse n'avait jusqu'ici aucune saisie client. `customerId` reste
    // prioritaire s'il est fourni (comportement inchangé) ; sinon, une
    // saisie libre nom/téléphone retrouve ou crée la fiche ShopCustomer
    // correspondante, pour que l'historique d'achats du client (créances,
    // relances) profite aussi de cette saisie, et pas seulement le document
    // imprimé. Fait hors transaction : une fiche client n'a pas besoin des
    // mêmes garanties d'atomicité que le décompte de stock ci-dessous.
    const customerId = dto.customerId ?? (await this.resoudreClientLibre(shopId, dto));

    let cmvTotal = 0;
    const sale = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const discrepancyByLineIndex = new Set<number>();

      for (const [index, line] of dto.lines.entries()) {
        total += line.quantity * line.unitPrice;

        if (line.variantId) {
          const variant = await tx.variant.findUniqueOrThrow({ where: { id: line.variantId } });

          // Mise à jour conditionnelle atomique (20 oct. 2026, audit de
          // lancement) : vérifier `stockQty` puis le décrémenter en deux
          // requêtes séparées laissait une fenêtre où deux ventes
          // concurrentes sur le dernier exemplaire (caisse + caisse, ou
          // caisse + Marketplace) pouvaient toutes deux passer la
          // vérification avant que l'une ne décrémente — une vraie
          // survente. `updateMany` avec `stockQty: { gte }` dans le WHERE
          // rend la vérification et la décrémentation indissociables au
          // niveau de la base de données elle-même.
          if (!options.allowNegativeStock) {
            const resultat = await tx.variant.updateMany({
              where: { id: line.variantId, stockQty: { gte: line.quantity } },
              data: { stockQty: { decrement: line.quantity } },
            });
            if (resultat.count === 0) {
              throw new BadRequestException(
                `Stock insuffisant pour ${variant.sku} : ${variant.stockQty} disponible(s), ${line.quantity} demandé(s).`,
              );
            }
          } else {
            // Synchronisation hors-ligne : la vente a déjà réellement eu
            // lieu pendant la coupure, jamais annulée — on accepte un stock
            // négatif et on signale l'écart au lieu de rejeter.
            if (variant.stockQty < line.quantity) {
              discrepancyByLineIndex.add(index);
            }
            await tx.variant.update({
              where: { id: line.variantId },
              data: { stockQty: { decrement: line.quantity } },
            });
          }

          // Valorisation CUMP de la sortie (chantier SYSCOHADA phase 4b, 14
          // oct. 2026) — `coutUnitaire`/`valeur` restent `null` tant que la
          // variante n'a jamais reçu de réception valorisée (voir
          // StockValorisationService) : jamais un coût inventé. `cmvTotal`
          // n'accumule que les lignes dont le coût est réellement connu.
          const cumpConnu = variant.coutMoyenPondere != null;
          const valeurSortie = cumpConnu ? Math.round(line.quantity * Number(variant.coutMoyenPondere) * 100) / 100 : null;
          if (valeurSortie !== null) cmvTotal += valeurSortie;

          await tx.stockMovement.create({
            data: {
              shopId,
              variantId: line.variantId,
              type: StockMovementType.POS_SALE_OUT,
              quantity: -line.quantity,
              coutUnitaire: cumpConnu ? variant.coutMoyenPondere : undefined,
              valeur: valeurSortie !== null ? -valeurSortie : undefined,
            },
          });
        }
        // Une ligne sans variantId est une vente rapide d'article non catalogué :
        // elle entre dans le chiffre d'affaires mais ne touche aucun stock
        // (complément stratégique §3 — ne jamais modifier arbitrairement d'autres articles).
      }

      const paidAmount = dto.payments.reduce((sum, p) => sum + p.amount, 0);
      if (Math.abs(paidAmount - total) > 0.01) {
        throw new BadRequestException(
          `Le total encaissé (${paidAmount}) ne correspond pas au total de la vente (${total}).`,
        );
      }

      const creditAmount = dto.payments
        .filter((p) => p.method === PaymentMethod.STORE_CREDIT)
        .reduce((sum, p) => sum + p.amount, 0);
      if (creditAmount > 0 && !customerId) {
        throw new BadRequestException("Un client est requis pour une vente à crédit.");
      }

      const sale = await tx.posSale.create({
        data: {
          shopId,
          cashierId: dto.cashierId,
          customerId,
          totalAmount: total,
          currency: dto.currency ?? "USD",
          clientOperationId: dto.clientOperationId,
          lines: {
            create: dto.lines.map((l, index) => ({
              variantId: l.variantId,
              label: l.label,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              stockDiscrepancy: discrepancyByLineIndex.has(index),
            })),
          },
          payments: {
            create: dto.payments.map((p) => ({
              method: p.method,
              amount: p.amount,
              confirmed: p.confirmed ?? true,
            })),
          },
        },
        include: { lines: true, payments: true },
      });

      // Vente à crédit : la part STORE_CREDIT augmente la créance du client
      // (complément stratégique §9), toujours dans la même transaction pour
      // qu'une vente et sa créance ne puissent jamais être incohérentes.
      if (creditAmount > 0 && customerId) {
        await tx.shopCustomer.update({
          where: { id: customerId },
          data: { creditBalance: { increment: creditAmount } },
        });
      }

      return sale;
    });

    // Comptabilisation après la transaction métier (jamais avant, jamais en
    // la réécrivant) — voir docs/ARCHITECTURE_FINANCE.md §8bis. Une erreur
    // de comptabilisation ne doit jamais annuler une vente dont l'argent a
    // réellement été encaissé : elle est journalisée, pas propagée. Le
    // marqueur ACCOUNTING_POSTING_FAILED permet de grepper ces échecs dans
    // les logs — par exemple une période clôturée par erreur (voir
    // docs/ARCHITECTURE_FINANCE.md §8quinquies), mais aussi toute autre
    // cause. Rappel distinct, confirmé le 16 oct. 2026 sur ELEGANZ STORE :
    // une vente antérieure à la mise en service de ce câblage comptable
    // (avant le commit qui l'a introduit) n'a et n'aura jamais d'écriture —
    // ce n'est ni une erreur ni un cas que ce marqueur peut détecter, car
    // aucune tentative de comptabilisation n'a jamais eu lieu pour elle.
    await this.accounting.postPosSale(sale).catch((err) => {
      this.logger.error(this.describePostingFailure("vente", sale.id, shopId, err), err);
    });

    // Écriture CMV séparée (chantier SYSCOHADA phase 4b) — seulement si au
    // moins une ligne avait un CUMP connu ; une erreur ici ne doit jamais
    // non plus annuler la vente déjà encaissée (même garde que ci-dessus).
    if (cmvTotal > 0) {
      await this.accounting.postSortieStockVente(sale, cmvTotal).catch((err) => {
        this.logger.error(this.describePostingFailure("CMV", sale.id, shopId, err), err);
      });
    }

    return sale;
  }

  /**
   * Retrouve ou crée la fiche `ShopCustomer` correspondant à une saisie libre
   * nom/téléphone à l'encaissement (19 nov. 2026). Recherche par téléphone
   * uniquement (un nom seul ne permet pas d'éviter les doublons de façon
   * fiable) ; une fiche trouvée n'est jamais modifiée ici (on ne réécrit
   * jamais silencieusement un nom déjà enregistré sur la foi d'une nouvelle
   * saisie, qui peut être une coquille). Sans téléphone, une nouvelle fiche
   * est créée à chaque vente plutôt que de tenter un rapprochement par nom
   * seul. Retourne `undefined` si ni nom ni téléphone n'ont été saisis — la
   * vente reste alors sans client, comme avant cette fonctionnalité.
   */
  private async resoudreClientLibre(shopId: string, dto: CreateSaleDto): Promise<string | undefined> {
    const nom = dto.customerName?.trim();
    const telephone = dto.customerPhone?.trim();
    if (!nom && !telephone) return undefined;

    if (telephone) {
      const existant = await this.prisma.shopCustomer.findFirst({ where: { shopId, phone: telephone } });
      if (existant) return existant.id;
    }

    const cree = await this.prisma.shopCustomer.create({
      data: { shopId, fullName: nom || "Client comptoir", phone: telephone || null },
    });
    return cree.id;
  }

  /**
   * Message de log greppable (marqueur `ACCOUNTING_POSTING_FAILED`) pour un
   * échec de comptabilisation volontairement avalé ci-dessus. Distingue le
   * cas d'une période clôturée (`ConflictException` levée par
   * `AccountingService.enregistrer` — voir accounting.service.ts) de toute
   * autre erreur, pour que ce cas précis soit repérable sans avoir à lire la
   * stack trace complète. Ce marqueur ne couvre que les tentatives de
   * comptabilisation qui ont réellement eu lieu et échoué : une vente
   * enregistrée avant la mise en service de ce câblage (voir l'historique
   * Git de ce fichier) n'a jamais déclenché d'appel ici, donc rien à
   * grepper pour elle — vérifié le 16 oct. 2026 sur ELEGANZ STORE, où le
   * Rapport annuel 2026 à $0 s'est avéré dû à des ventes du 12 oct. 2026,
   * antérieures de plus d'une journée au premier commit câblant
   * `postPosSale` (cc06305, 13 oct. 2026 22h10), et non à une période
   * clôturée.
   */
  private describePostingFailure(nature: string, saleId: string, shopId: string, err: unknown): string {
    if (err instanceof ConflictException) {
      return (
        `ACCOUNTING_POSTING_FAILED période clôturée : comptabilisation du ${nature} de la vente ${saleId} ` +
        `(boutique ${shopId}) refusée — vérifier /finance/cloture pour cette boutique et rouvrir la période si ` +
        `elle a été clôturée par erreur, puis rejouer cette écriture.`
      );
    }
    return `ACCOUNTING_POSTING_FAILED comptabilisation du ${nature} de la vente ${saleId} (boutique ${shopId}) échouée`;
  }

  /**
   * Point d'entrée de synchronisation hors-ligne
   * (docs/ARCHITECTURE_HORS_LIGNE.md, phase 1). Idempotent sur
   * `clientOperationId`, généré côté client avant tout appel réseau : si la
   * même opération est envoyée deux fois (coupure pendant la réponse,
   * nouvelle tentative de l'appareil), on renvoie la vente déjà enregistrée
   * au lieu d'en créer une seconde et de décompter le stock deux fois.
   */
  async syncOfflineSale(
    shopId: string,
    dto: CreateSaleDto & { cashierId: string; clientOperationId: string },
  ) {
    const existante = await this.prisma.posSale.findUnique({
      where: { clientOperationId: dto.clientOperationId },
      include: { lines: true, payments: true },
    });
    if (existante) {
      return existante;
    }
    return this.createSale(shopId, dto, { allowNegativeStock: true });
  }

  /**
   * Lignes de vente dont le stock est descendu sous zéro pendant une
   * synchronisation différée — à régulariser manuellement par la boutique
   * (comptage, remboursement, réapprovisionnement). Jamais corrigé seul par
   * le système : c'est une décision commerciale, pas technique.
   */
  async listStockDiscrepancies(shopId: string) {
    return this.prisma.posSaleLine.findMany({
      where: { stockDiscrepancy: true, sale: { shopId } },
      include: { sale: { select: { id: true, createdAt: true, cashierId: true } }, variant: true },
      orderBy: { sale: { createdAt: "desc" } },
    });
  }

  /**
   * Annulation d'une vente caisse. Corrigé le 20 oct. 2026 (audit de
   * lancement) : la version précédente ne recevait pas `shopId` et ne
   * vérifiait jamais que la vente appartenait bien à la boutique de
   * l'appelant — n'importe quel membre authentifié d'une boutique pouvait
   * annuler la vente d'une AUTRE boutique en devinant son identifiant.
   * Scopée désormais comme toutes les autres opérations (`findFirstOrThrow`
   * sur `shopId`), et protégée côté contrôleur par `@ShopRoles`. Ajout aussi
   * d'une garde d'idempotence : annuler deux fois la même vente aurait
   * sinon restitué le stock deux fois.
   */
  async cancelSale(shopId: string, saleId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.posSale.findFirstOrThrow({
        where: { id: saleId, shopId },
        include: { lines: true },
      });

      if (sale.status === "CANCELLED") {
        return sale;
      }

      for (const line of sale.lines) {
        if (line.variantId) {
          await tx.variant.update({
            where: { id: line.variantId },
            data: { stockQty: { increment: line.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              shopId: sale.shopId,
              variantId: line.variantId,
              type: StockMovementType.RETURN_IN,
              quantity: line.quantity,
              reference: sale.id,
            },
          });
        }
      }

      return tx.posSale.update({ where: { id: saleId }, data: { status: "CANCELLED" } });
    });
  }

  /**
   * Tableau de bord chiffre d'affaires journalier (complément stratégique §4).
   * Distingue explicitement CA, encaissements confirmés et bénéfice.
   *
   * Marge brute harmonisée avec le CUMP réellement comptabilisé (14 oct.
   * 2026, chantier SYSCOHADA) — voir finance.service.ts::dashboardForShop
   * pour le même changement et son motif : le CMV vient des
   * StockMovement(POS_SALE_OUT) déjà valorisés au CUMP lors de la vente,
   * plus fiable que l'ancien Variant.costPrice (champ manuel, jamais
   * synchronisé avec les réceptions de stock).
   */
  async dailyDashboard(shopId: string, date: Date = new Date()) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [sales, cmvAgg, cmvInconnuCount] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { shopId, createdAt: { gte: startOfDay, lt: endOfDay }, status: { not: "CANCELLED" } },
        include: { lines: true, payments: true },
      }),
      this.prisma.stockMovement.aggregate({
        where: { shopId, type: StockMovementType.POS_SALE_OUT, createdAt: { gte: startOfDay, lt: endOfDay } },
        _sum: { valeur: true },
      }),
      this.prisma.stockMovement.count({
        where: {
          shopId,
          type: StockMovementType.POS_SALE_OUT,
          createdAt: { gte: startOfDay, lt: endOfDay },
          valeur: null,
        },
      }),
    ]);

    const revenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const confirmedCollections = sales.reduce(
      (sum, s) => sum + s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0),
      0,
    );

    const venteSansVariante = sales.some((s) => s.lines.some((l) => !l.variantId));
    const costKnownForAllLines = cmvInconnuCount === 0 && !venteSansVariante;
    const cmvDuJour = -(Number(cmvAgg._sum.valeur ?? 0));
    const grossMargin = revenue - cmvDuJour;

    return {
      date: startOfDay.toISOString().slice(0, 10),
      salesCount: sales.length,
      revenue, // chiffre d'affaires — ne pas confondre avec le bénéfice
      confirmedCollections, // encaissements réellement confirmés
      grossMargin: costKnownForAllLines ? grossMargin : null,
      marginReliable: costKnownForAllLines,
      note: costKnownForAllLines
        ? undefined
        : "Marge non calculable de façon fiable : coût moyen pondéré (CUMP) inconnu pour au moins un article vendu, ou vente rapide sans article catalogué.",
    };
  }

  /**
   * Clé + libellé de bucket temporel pour une date donnée. Même convention
   * que `ReportsService.cleBucket` (lundi UTC pour le début de semaine, clé
   * ISO), reproduite ici plutôt qu'importée : le tableau de bord POS n'a pas
   * besoin du moteur de regroupement multi-groupes de `ReportsService`
   * (boutique/agent/catégorie), juste d'un seul total par période. Libellés
   * volontairement courts (axe de graphique, pas un rapport imprimé).
   */
  private cleDePeriode(date: Date, granularite: "JOUR" | "SEMAINE" | "MOIS"): { cle: string; label: string } {
    const d = new Date(date);
    if (granularite === "JOUR") {
      const cle = d.toISOString().slice(0, 10);
      return { cle, label: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d) };
    }
    if (granularite === "SEMAINE") {
      const lundi = new Date(d);
      const jourSemaine = (lundi.getUTCDay() + 6) % 7; // 0 = lundi ... 6 = dimanche
      lundi.setUTCDate(lundi.getUTCDate() - jourSemaine);
      lundi.setUTCHours(0, 0, 0, 0);
      const cle = lundi.toISOString().slice(0, 10);
      return { cle, label: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(lundi) };
    }
    // MOIS
    const cle = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const libelle = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(d);
    return { cle, label: libelle.charAt(0).toUpperCase() + libelle.slice(1) };
  }

  /**
   * Séquence complète des buckets entre `debut` (inclus) et `fin` (exclue),
   * y compris les périodes sans aucune vente — indispensable pour un
   * graphique d'évolution : un jour à zéro vente doit apparaître comme un
   * point à zéro, pas disparaître (un trou invisible fausserait la lecture
   * de l'espacement et de la tendance).
   */
  private genererSequencePeriodes(
    debut: Date,
    fin: Date,
    granularite: "JOUR" | "SEMAINE" | "MOIS",
  ): { cle: string; label: string }[] {
    const sequence: { cle: string; label: string }[] = [];
    const curseur = new Date(debut);
    if (granularite === "SEMAINE") {
      const jourSemaine = (curseur.getUTCDay() + 6) % 7;
      curseur.setUTCDate(curseur.getUTCDate() - jourSemaine);
    }
    if (granularite === "MOIS") {
      curseur.setUTCDate(1);
    }
    curseur.setUTCHours(0, 0, 0, 0);

    while (curseur < fin) {
      sequence.push(this.cleDePeriode(curseur, granularite));
      if (granularite === "JOUR") curseur.setUTCDate(curseur.getUTCDate() + 1);
      else if (granularite === "SEMAINE") curseur.setUTCDate(curseur.getUTCDate() + 7);
      else curseur.setUTCMonth(curseur.getUTCMonth() + 1);
    }
    return sequence;
  }

  /**
   * Tableau de bord de gestion — évolution sur une période (demande du 19
   * nov. 2026 : "rajouter... des rapports de gestion d'activité et
   * périodique et des graphiques des évolutions"). Même formule de marge que
   * `dailyDashboard` ci-dessus (CUMP via StockMovement POS_SALE_OUT),
   * agrégée par bucket plutôt que sur une seule journée, pour que le
   * graphique affiche exactement les mêmes chiffres que les cartes du jour
   * quand on zoome sur un seul jour.
   *
   * Pas de répartition par devise ici (contrairement à
   * `CustomersService.rapport`) : `dailyDashboard` ci-dessus ne le fait déjà
   * pas, et faire autrement ici créerait une incohérence entre le "CA
   * aujourd'hui" affiché en haut de la page et le même jour affiché dans le
   * graphique d'évolution juste en dessous.
   */
  async evolutionDashboard(shopId: string, from?: Date, to?: Date, granulariteBrute?: string) {
    const granularite: "JOUR" | "SEMAINE" | "MOIS" =
      granulariteBrute === "SEMAINE" || granulariteBrute === "MOIS" ? granulariteBrute : "JOUR";

    const fin = to ? new Date(to) : new Date();
    fin.setHours(0, 0, 0, 0);
    fin.setDate(fin.getDate() + 1); // borne exclusive : lendemain du jour "to" inclus

    const debut = from ? new Date(from) : new Date(fin);
    if (!from) {
      debut.setDate(debut.getDate() - 30);
    }
    debut.setHours(0, 0, 0, 0);

    if (debut >= fin) {
      throw new BadRequestException("La date de début doit précéder la date de fin.");
    }

    const periodes = this.genererSequencePeriodes(debut, fin, granularite);
    if (periodes.length > 400) {
      throw new BadRequestException("Plage trop longue pour cette granularité — réduisez l'intervalle.");
    }

    const [sales, mouvementsCmv] = await Promise.all([
      this.prisma.posSale.findMany({
        where: { shopId, createdAt: { gte: debut, lt: fin }, status: { not: "CANCELLED" } },
        include: { lines: true, payments: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { shopId, type: StockMovementType.POS_SALE_OUT, createdAt: { gte: debut, lt: fin } },
        select: { createdAt: true, valeur: true },
      }),
    ]);

    interface Accumulateur {
      revenue: number;
      salesCount: number;
      confirmedCollections: number;
      cmv: number;
      cmvInconnuCount: number;
      venteSansVariante: boolean;
    }
    const parCle = new Map<string, Accumulateur>();
    const bucketVide = (): Accumulateur => ({
      revenue: 0,
      salesCount: 0,
      confirmedCollections: 0,
      cmv: 0,
      cmvInconnuCount: 0,
      venteSansVariante: false,
    });

    for (const s of sales) {
      const { cle } = this.cleDePeriode(s.createdAt, granularite);
      const acc = parCle.get(cle) ?? bucketVide();
      acc.revenue += Number(s.totalAmount);
      acc.salesCount += 1;
      acc.confirmedCollections += s.payments.filter((p) => p.confirmed).reduce((a, p) => a + Number(p.amount), 0);
      if (s.lines.some((l) => !l.variantId)) acc.venteSansVariante = true;
      parCle.set(cle, acc);
    }

    for (const m of mouvementsCmv) {
      const { cle } = this.cleDePeriode(m.createdAt, granularite);
      const acc = parCle.get(cle) ?? bucketVide();
      if (m.valeur === null) acc.cmvInconnuCount += 1;
      else acc.cmv += -Number(m.valeur);
      parCle.set(cle, acc);
    }

    const points = periodes.map((p) => {
      const acc = parCle.get(p.cle) ?? bucketVide();
      const margeFiable = acc.cmvInconnuCount === 0 && !acc.venteSansVariante;
      return {
        periode: p.cle,
        label: p.label,
        salesCount: acc.salesCount,
        revenue: acc.revenue,
        confirmedCollections: acc.confirmedCollections,
        panierMoyen: acc.salesCount > 0 ? acc.revenue / acc.salesCount : 0,
        grossMargin: margeFiable ? acc.revenue - acc.cmv : null,
        marginReliable: margeFiable,
      };
    });

    const totalRevenue = points.reduce((s, p) => s + p.revenue, 0);
    const totalSalesCount = points.reduce((s, p) => s + p.salesCount, 0);
    const margeToujoursFiable = points.every((p) => p.marginReliable);

    return {
      granularite,
      from: debut.toISOString().slice(0, 10),
      to: new Date(fin.getTime() - 1).toISOString().slice(0, 10),
      points,
      totaux: {
        revenue: totalRevenue,
        salesCount: totalSalesCount,
        panierMoyen: totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0,
        grossMargin: margeToujoursFiable ? points.reduce((s, p) => s + (p.grossMargin ?? 0), 0) : null,
      },
    };
  }
}
