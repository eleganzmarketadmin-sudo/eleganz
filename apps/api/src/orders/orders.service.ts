import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { NotificationType, OrderStatus, PaymentMethod, Prisma, StockMovementType } from "@eleganz/database";
import { AccountingService } from "../finance/accounting.service";
import { NotificationsService } from "../notifications/notifications.service";
import { prixUnitaireEffectif } from "../common/pricing.util";

// Transitions légales du statut d'une sous-commande (prompt §42). Toute
// transition hors de cette carte est refusée — évite qu'un statut saute une
// étape (ex. CREATED -> DELIVERED_DECLARED directement). Ce circuit suppose
// que le paiement est réglé (mobile money) avant que la boutique n'accepte
// la commande — adapté au paiement au moment de la commande.
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [OrderStatus.PAYMENT_PENDING, OrderStatus.CANCELLED],
  PAYMENT_PENDING: [OrderStatus.PAYMENT_CONFIRMED, OrderStatus.CANCELLED],
  PAYMENT_CONFIRMED: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY_FOR_PICKUP],
  READY_FOR_PICKUP: [OrderStatus.PICKED_UP],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.DELIVERED_DECLARED],
  // RECEIVED_CONFIRMED est un événement distinct, déclenché par l'acheteur
  // (confirmReceipt ci-dessous), jamais par cette carte de transitions staff.
  DELIVERED_DECLARED: [OrderStatus.DISPUTED],
  RECEIVED_CONFIRMED: [OrderStatus.CLOSED, OrderStatus.RETURN_REQUESTED],
  RETURN_REQUESTED: [OrderStatus.REFUNDED, OrderStatus.DISPUTED],
  DISPUTED: [OrderStatus.REFUNDED, OrderStatus.RECEIVED_CONFIRMED],
  CLOSED: [],
  CANCELLED: [],
  REFUNDED: [],
};

// Second circuit de suivi, pour les commandes payées en espèces à la
// livraison (demande du 10 nov. 2026, point 2) — le circuit ci-dessus
// oblige à "confirmer le paiement" avant même d'accepter la commande, ce qui
// n'a aucun sens tant que le livreur n'a pas effectivement perçu l'argent.
// Ici PAYMENT_PENDING/PAYMENT_CONFIRMED sont déplacés juste avant
// DELIVERED_DECLARED : la boutique accepte et prépare la commande sans rien
// à confirmer au départ, et confirme la réception de l'argent au moment de
// la livraison (une fois IN_TRANSIT), pas avant.
const ALLOWED_TRANSITIONS_PAIEMENT_LIVRAISON: Record<OrderStatus, OrderStatus[]> = {
  CREATED: [OrderStatus.ACCEPTED, OrderStatus.CANCELLED],
  PAYMENT_PENDING: [], // étape inutilisée dans ce circuit
  PAYMENT_CONFIRMED: [OrderStatus.DELIVERED_DECLARED],
  ACCEPTED: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY_FOR_PICKUP],
  READY_FOR_PICKUP: [OrderStatus.PICKED_UP],
  PICKED_UP: [OrderStatus.IN_TRANSIT],
  IN_TRANSIT: [OrderStatus.PAYMENT_CONFIRMED],
  DELIVERED_DECLARED: [OrderStatus.DISPUTED],
  RECEIVED_CONFIRMED: [OrderStatus.CLOSED, OrderStatus.RETURN_REQUESTED],
  RETURN_REQUESTED: [OrderStatus.REFUNDED, OrderStatus.DISPUTED],
  DISPUTED: [OrderStatus.REFUNDED, OrderStatus.RECEIVED_CONFIRMED],
  CLOSED: [],
  CANCELLED: [],
  REFUNDED: [],
};

/** Choisit le circuit de suivi selon le mode de paiement annoncé par
 * l'acheteur à la commande (voir createOrder ci-dessous) — CASH_ON_DELIVERY
 * suit le second circuit, tout le reste (mobile money) garde le premier.
 *
 * Paiement échelonné (26 nov. 2026) : une sous-commande avec au moins un
 * échéancier suit AUSSI le second circuit — même réutilisation, pas de 3ᵉ
 * circuit créé : l'idée (la marchandise part avant que le règlement soit
 * complètement bouclé) est déjà exactement celle de ce circuit, qu'il
 * s'agisse d'espèces à la livraison ou de tranches étalées dans le temps. */
function circuitSuivi(
  methodePaiement: PaymentMethod | undefined,
  aDesEchelonnements: boolean,
): Record<OrderStatus, OrderStatus[]> {
  return methodePaiement === PaymentMethod.CASH_ON_DELIVERY || aDesEchelonnements
    ? ALLOWED_TRANSITIONS_PAIEMENT_LIVRAISON
    : ALLOWED_TRANSITIONS;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accounting: AccountingService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Commande multivendeurs (prompt §48) : une seule commande client,
   * découpée en sous-commandes par boutique, chaque vendeur ne voyant que la
   * sienne. Le stock est décompté dans la même transaction pour empêcher
   * qu'une vente en caisse concurrente ne vende le même article.
   */
  async createOrder(buyerId: string, dto: CreateOrderDto) {
    const order = await this.prisma.$transaction(async (tx) => {
      // Réglages plateforme lus une seule fois, en tête de transaction —
      // réutilisés à la fois pour la validation d'éligibilité au paiement
      // échelonné ci-dessous et pour le calcul de commission plus bas (qui
      // lisait déjà ce même modèle séparément avant ce chantier ; fusionné
      // ici pour n'avoir qu'une seule lecture de PlatformSettings).
      const platformSettings = await tx.platformSettings.findUnique({
        where: { id: "platform" },
        select: {
          marketplaceCommissionRateDefault: true,
          marketplaceCommissionFreeMonths: true,
          marketplaceCommissionMinAmount: true,
          paiementEchelonneActivePlateforme: true,
        },
      });

      // Paiement échelonné (26 nov. 2026) — chaque ligne garde son
      // `productId` (pour regrouper les lignes échelonnées par article,
      // voir plus bas) et le choix `paiementEchelonne` de l'acheteur pour
      // CETTE ligne (décision du propriétaire : un panier peut mélanger
      // plusieurs articles éligibles, chacun son échéancier — voir le
      // commentaire sur EchelonnementAchat dans schema.prisma).
      const byShop = new Map<
        string,
        { variantId: string; quantity: number; unitPrice: number; productId: string; paiementEchelonne: boolean }[]
      >();

      for (const item of dto.items) {
        const variant = await tx.variant.findUniqueOrThrow({
          where: { id: item.variantId },
          include: { product: true, priceTiers: true },
        });

        if (!variant.product.isPublished) {
          throw new BadRequestException(`Le produit ${variant.product.name} n'est pas publié.`);
        }

        // Refus explicite plutôt qu'un échelonnement silencieusement ignoré
        // — soit l'interrupteur global est coupé (l'admin a pu le
        // désactiver sans toucher à la configuration de chaque boutique),
        // soit CET article précis n'a jamais activé l'option.
        if (item.paiementEchelonne) {
          if (!platformSettings?.paiementEchelonneActivePlateforme) {
            throw new BadRequestException("Le paiement échelonné n'est pas disponible actuellement.");
          }
          if (!variant.product.paiementEchelonneActif) {
            throw new BadRequestException(`Le paiement échelonné n'est pas disponible pour ${variant.product.name}.`);
          }
        }

        // Mise à jour conditionnelle atomique (20 oct. 2026, audit de
        // lancement) — même correctif que PosService.createSale : vérifier
        // puis décrémenter en deux requêtes séparées laissait une fenêtre où
        // une vente caisse concurrente sur le même article pouvait aussi
        // passer la vérification, provoquant une survente.
        const resultat = await tx.variant.updateMany({
          where: { id: item.variantId, stockQty: { gte: item.quantity } },
          data: { stockQty: { decrement: item.quantity } },
        });
        if (resultat.count === 0) {
          throw new BadRequestException(
            `Stock insuffisant pour ${variant.sku} : ${variant.stockQty} disponible(s) (ou vendu entre-temps).`,
          );
        }
        await tx.stockMovement.create({
          data: {
            shopId: variant.product.shopId,
            variantId: item.variantId,
            type: StockMovementType.ONLINE_SALE_RESERVED,
            quantity: -item.quantity,
          },
        });

        // Prix de gros par palier (2 nov. 2026) — le prix facturé n'est
        // jamais celui envoyé par le client (cohérent avec le reste de ce
        // module : `unitPrice` est toujours recalculé côté serveur depuis la
        // base), seulement dérivé de `sellPrice` + des paliers actifs de la
        // variante selon la quantité réellement commandée.
        const prixUnitaire = prixUnitaireEffectif(
          item.quantity,
          Number(variant.sellPrice),
          variant.priceTiers.map((p) => ({ minQuantity: p.minQuantity, unitPrice: Number(p.unitPrice) })),
        );

        const shopItems = byShop.get(variant.product.shopId) ?? [];
        shopItems.push({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: prixUnitaire,
          productId: variant.product.id,
          paiementEchelonne: Boolean(item.paiementEchelonne),
        });
        byShop.set(variant.product.shopId, shopItems);
      }

      const totalAmount = [...byShop.values()]
        .flat()
        .reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

      // Portion échelonnée du total, toutes boutiques confondues — exclue de
      // l'OrderPayment créé plus bas, qui ne doit couvrir que ce qui reste à
      // régler maintenant (voir le commentaire sur EchelonnementAchat.
      // montantCash dans schema.prisma : l'intérêt est réglé via les
      // tranches, jamais via cet OrderPayment).
      const montantEchelonneTotal = [...byShop.values()]
        .flat()
        .filter((l) => l.paiementEchelonne)
        .reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
      const montantPayeMaintenant = totalAmount - montantEchelonneTotal;

      // Commission ELEGANZ Market (14 oct. 2026, plan commercial) : taux du
      // bouquet Marketplace de la boutique, sinon le taux par défaut de la
      // plateforme, sinon 0 — jamais une valeur inventée. Calculée une fois
      // ici (pas recalculée a posteriori) pour que le taux facturé soit celui
      // en vigueur au moment de la vente, même si l'admin le change ensuite —
      // même principe que le taux de change (docs/PROJECT_STATUS.md).
      //
      // Exonération (14 nov. 2026, demande : "le paiement bénéficiera des
      // mêmes conditions d'exemption que les boutiques dans Gestion... la
      // durée doit être modifiable également dans le centre de pilotage") :
      // décomptée depuis Shop.freeTrialStartedAt (même date de départ que
      // l'exonération du frais d'ouverture Gestion, posée à la création de
      // chaque boutique — voir ShopsService.create), mais avec sa propre
      // durée indépendante (PlatformSettings.marketplaceCommissionFreeMonths,
      // 6 mois par défaut). Même convention que BillingService.
      // processTrialExpirations pour une boutique sans freeTrialStartedAt
      // (données anciennes/irrégulières) : on ne prend jamais une commission
      // sur une date de départ inconnue, donc la boutique reste exonérée.
      //
      // Paiement échelonné (26 nov. 2026) : la commission reste calculée sur
      // `subtotal` (prix comptant, intérêt exclu) — aucun changement ici,
      // décision du propriétaire de ne pas faire gagner ELEGANZ sur
      // l'intérêt perçu par la boutique.
      const shopIds = [...byShop.keys()];
      const shopsAvecBouquet = await tx.shop.findMany({
        where: { id: { in: shopIds } },
        select: {
          id: true,
          freeTrialStartedAt: true,
          marketplaceBouquet: { select: { commissionRate: true } },
        },
      });
      const moisExoneration = platformSettings?.marketplaceCommissionFreeMonths ?? 0;
      const now = new Date();
      const tauxParBoutique = new Map(
        shopsAvecBouquet.map((s) => {
          if (!s.freeTrialStartedAt) return [s.id, 0];
          const finExoneration = new Date(s.freeTrialStartedAt);
          finExoneration.setMonth(finExoneration.getMonth() + moisExoneration);
          if (now < finExoneration) return [s.id, 0];
          return [
            s.id,
            Number(s.marketplaceBouquet?.commissionRate ?? platformSettings?.marketplaceCommissionRateDefault ?? 0),
          ];
        }),
      );

      const order = await tx.order.create({
        data: {
          buyerId,
          totalAmount,
          buyerWhatsapp: dto.buyerWhatsapp,
          buyerPhone: dto.buyerPhone,
          deliveryCommune: dto.deliveryCommune,
          deliveryQuartier: dto.deliveryQuartier,
          deliveryAvenue: dto.deliveryAvenue,
          deliveryRepere: dto.deliveryRepere,
          deliveryNote: dto.deliveryNote,
          // Intention de paiement (demande du 10 nov. 2026, point 4) — simple
          // enregistrement informatif (`confirmed: false`, aucune passerelle
          // branchée) : voir le commentaire sur CreateOrderDto.paymentMethod.
          // Paiement échelonné (26 nov. 2026) : ne couvre que la portion non
          // échelonnée (`montantPayeMaintenant`) — omis entièrement quand
          // elle est nulle (panier intégralement échelonné), ce qu'acceptent
          // déjà tous les lecteurs existants (`payments?.[0]`).
          ...(montantPayeMaintenant > 0
            ? {
                payments: {
                  create: {
                    method:
                      dto.paymentMethod === "MOBILE_MONEY" ? PaymentMethod.MOBILE_MONEY : PaymentMethod.CASH_ON_DELIVERY,
                    provider: dto.paymentMethod === "MOBILE_MONEY" ? "mobile_money_a_la_livraison" : "cash_on_delivery",
                    amount: montantPayeMaintenant,
                    confirmed: false,
                  },
                },
              }
            : {}),
          shopOrders: {
            create: [...byShop.entries()].map(([shopId, items]) => {
              const subtotal = items.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
              const taux = tauxParBoutique.get(shopId) ?? 0;
              // Plancher (14 nov. 2026) : ne relève que la commission
              // réellement due (taux > 0, donc ni exonérée ni désactivée) —
              // voir PlatformSettings.marketplaceCommissionMinAmount. Une
              // boutique à 0 % reste à 0, jamais relevée artificiellement.
              let commissionAmount = Math.round(subtotal * (taux / 100) * 100) / 100;
              if (taux > 0 && platformSettings?.marketplaceCommissionMinAmount != null) {
                commissionAmount = Math.max(commissionAmount, Number(platformSettings.marketplaceCommissionMinAmount));
              }
              return {
                shopId,
                subtotal,
                commissionAmount,
                lines: {
                  create: items.map((it) => ({
                    variantId: it.variantId,
                    quantity: it.quantity,
                    unitPrice: it.unitPrice,
                  })),
                },
              };
            }),
          },
        },
        include: { shopOrders: { include: { lines: true } } },
      });

      // Point de départ de l'historique de statut (demande du 12 oct. 2026,
      // point 4) — sans cet événement CREATED, le délai d'acceptation d'une
      // boutique ne pourrait jamais être calculé pour cette commande.
      await tx.orderStatusEvent.createMany({
        data: order.shopOrders.map((so) => ({ shopOrderId: so.id, status: OrderStatus.CREATED })),
      });

      // Paiement échelonné (26 nov. 2026) — un échéancier par (boutique,
      // article éligible marqué par l'acheteur), fait APRÈS la création des
      // OrderLine ci-dessus pour pouvoir les y rattacher (`echelonnementId`).
      // Les variantes d'un même produit fusionnent dans UN SEUL échéancier
      // (voir le commentaire sur EchelonnementAchat dans schema.prisma).
      for (const shopOrder of order.shopOrders) {
        const itemsBoutique = byShop.get(shopOrder.shopId) ?? [];
        const parProduit = new Map<string, typeof itemsBoutique>();
        for (const it of itemsBoutique) {
          if (!it.paiementEchelonne) continue;
          const liste = parProduit.get(it.productId) ?? [];
          liste.push(it);
          parProduit.set(it.productId, liste);
        }

        for (const [productId, lignesEchelonnees] of parProduit) {
          const produit = await tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { paiementEchelonneNombreTranches: true, paiementEchelonneTauxInteretPct: true },
          });
          // Secours défensif (ne devrait jamais arriver : l'éligibilité est
          // déjà vérifiée plus haut, et CatalogService.updateProduct exige
          // ces deux champs dès que l'option est active) — mieux vaut un
          // échéancier à 1 tranche sans intérêt qu'un plantage en pleine
          // transaction de commande.
          const nombreTranches = produit.paiementEchelonneNombreTranches ?? 1;
          const tauxInteretPct = Number(produit.paiementEchelonneTauxInteretPct ?? 0);
          const montantCash = lignesEchelonnees.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
          const montantTotal = Math.round(montantCash * (1 + tauxInteretPct / 100) * 100) / 100;

          const echelonnement = await tx.echelonnementAchat.create({
            data: {
              shopOrderId: shopOrder.id,
              productId,
              nombreTranches,
              tauxInteretPct,
              montantCash,
              montantTotal,
            },
          });

          // Répartition égale entre les tranches, la DERNIÈRE absorbant
          // l'écart d'arrondi — même soin que `commissionAmount` plus haut.
          const montantParTranche = Math.round((montantTotal / nombreTranches) * 100) / 100;
          const dateCommande = new Date();
          let cumul = 0;
          for (let numero = 1; numero <= nombreTranches; numero++) {
            const estDerniere = numero === nombreTranches;
            const montant = estDerniere ? Math.round((montantTotal - cumul) * 100) / 100 : montantParTranche;
            cumul += montant;
            // Tranche 1 = date de la commande (due immédiatement, en
            // parallèle de la portion "normale" qui suit son propre circuit
            // de livraison) ; tranche k (k>=2) = +(k-1) mois.
            const dateEcheance = new Date(dateCommande);
            dateEcheance.setMonth(dateEcheance.getMonth() + (numero - 1));
            await tx.echelonnementTranche.create({
              data: { echelonnementId: echelonnement.id, numero, montant, dateEcheance },
            });
          }

          await tx.orderLine.updateMany({
            where: { shopOrderId: shopOrder.id, variantId: { in: lignesEchelonnees.map((l) => l.variantId) } },
            data: { echelonnementId: echelonnement.id },
          });
        }
      }

      return order;
    });

    // Notification "commande reçue" (demande UX du 15 oct. 2026, point 7) —
    // chaque boutique concernée par la commande (son propriétaire + son
    // équipe active) est notifiée, sans bloquer la réponse à l'acheteur si
    // la notification échoue.
    this.notifierBoutiquesCommandeRecue(order.shopOrders.map((so) => so.shopId)).catch((err) => {
      this.logger.error(`Notification "commande reçue" échouée pour la commande ${order.id}`, err);
    });

    return order;
  }

  private async notifierBoutiquesCommandeRecue(shopIds: string[]) {
    const uniqueShopIds = [...new Set(shopIds)];
    const shops = await this.prisma.shop.findMany({
      where: { id: { in: uniqueShopIds } },
      select: {
        id: true,
        name: true,
        ownerId: true,
        staff: { where: { active: true }, select: { userId: true } },
      },
    });
    for (const shop of shops) {
      const destinataires = [shop.ownerId, ...shop.staff.map((s) => s.userId)];
      await this.notifications.notifierUtilisateurs(destinataires, {
        type: NotificationType.COMMANDE_RECUE,
        title: "Nouvelle commande reçue",
        body: `${shop.name} a reçu une nouvelle commande.`,
        link: "/commandes",
      });
    }
  }

  listForBuyer(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        // Mode de paiement annoncé à la commande (10 nov. 2026, point 2) —
        // l'écran en a besoin pour savoir quel circuit de suivi afficher
        // (paiement au moment de la commande vs paiement à la livraison),
        // seulement `method` : jamais le détail interne de l'OrderPayment.
        payments: { select: { method: true } },
        shopOrders: {
          include: {
            lines: { include: { variant: { include: { product: { select: { id: true, name: true } } } } } },
            // L'acheteur voit seulement à qui sa commande est confiée pour
            // la livraison (prompt du 13 oct. 2026, point 3) — aucune autre
            // information sur le livreur (téléphone, véhicule...).
            driver: { select: { user: { select: { fullName: true } } } },
            // Paiement échelonné (26 nov. 2026) — échéanciers en cours,
            // lecture seule pour l'acheteur (il ne peut pas marquer une
            // tranche payée lui-même, seule la boutique le peut).
            echelonnements: {
              include: {
                product: { select: { name: true } },
                tranches: { orderBy: { numero: "asc" } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listForShop(shopId: string) {
    return this.prisma.shopOrder.findMany({
      where: { shopId },
      include: {
        lines: { include: { variant: { include: { product: { select: { name: true } } } } } },
        // Le vendeur garde la main sur l'affectation et doit voir qui est
        // affecté pour pouvoir en changer (prompt du 13 oct. 2026, point 1).
        driver: { select: { id: true, user: { select: { fullName: true } } } },
        // Paiement échelonné (26 nov. 2026) — la boutique a besoin du détail
        // complet (montants/dates/statut) pour marquer les tranches reçues.
        echelonnements: {
          include: {
            product: { select: { name: true } },
            tranches: { orderBy: { numero: "asc" } },
          },
        },
        // Livreur propre à la boutique (13 oct. 2026, remplace le réseau
        // plateforme pour les nouvelles affectations) — voir ShopDriver.
        shopDriver: { select: { id: true, fullName: true, phone: true } },
        order: {
          select: {
            id: true,
            buyerId: true,
            createdAt: true,
            buyer: { select: { fullName: true, phone: true } },
            buyerWhatsapp: true,
            buyerPhone: true,
            deliveryCommune: true,
            deliveryQuartier: true,
            deliveryAvenue: true,
            deliveryRepere: true,
            deliveryNote: true,
            // Intention de paiement annoncée par l'acheteur (10 nov. 2026,
            // point 4) — juste `method`/`confirmed`, jamais le détail de
            // l'OrderPayment complet (provider/providerRef internes).
            payments: { select: { method: true, confirmed: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Preuve de livraison par code à usage unique (18 oct. 2026, audit
   * "preuve de livraison simulée/placeholder" — avant ce correctif,
   * `proofCode` était accepté par l'API mais jamais stocké ni vérifié).
   * Généré au passage à IN_TRANSIT (donné à l'acheteur par notification et
   * via /marketplace/orders/mine), exigé en `deliveryCode` pour faire
   * passer la sous-commande à DELIVERED_DECLARED, puis remis à null pour ne
   * jamais pouvoir être réutilisé. 4 chiffres : assez pour dissuader une
   * déclaration de livraison sans l'accord de l'acheteur, pas un secret
   * cryptographique — l'acheteur le communique de vive voix au livreur.
   */
  async transitionStatus(shopId: string, shopOrderId: string, newStatus: OrderStatus, deliveryCode?: string) {
    // 21 oct. 2026 (audit sécurité) : IDOR corrigé — avant ce correctif,
    // `findUniqueOrThrow` ne filtrait que sur `shopOrderId`, donc un employé
    // de la boutique A (passant le `ShopMembershipGuard` sur SA propre
    // boutique) pouvait transitionner la sous-commande d'une boutique B en
    // devinant/énumérant son UUID. `findFirstOrThrow` avec `shopId` force
    // l'appartenance réelle à la boutique de l'URL.
    const shopOrder = await this.prisma.shopOrder.findFirstOrThrow({
      where: { id: shopOrderId, shopId },
      include: {
        lines: true,
        order: { include: { payments: { select: { method: true } } } },
        shop: { select: { name: true } },
        // Paiement échelonné (26 nov. 2026) — juste l'id suffit à
        // circuitSuivi (il ne compte que la présence d'au moins un
        // échéancier, voir son commentaire).
        echelonnements: { select: { id: true } },
      },
    });
    const allowed =
      circuitSuivi(shopOrder.order.payments[0]?.method, shopOrder.echelonnements.length > 0)[shopOrder.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Transition ${shopOrder.status} → ${newStatus} non autorisée.`);
    }

    if (newStatus === OrderStatus.DELIVERED_DECLARED) {
      if (!shopOrder.deliveryCode) {
        // Commande antérieure à la mise en service de ce câblage (voir
        // l'historique Git de ce fichier), ou IN_TRANSIT jamais traversé
        // normalement — jamais bloquant pour ne pas empêcher une livraison
        // réelle à cause d'un trou de données historique.
        this.logger.warn(`Sous-commande ${shopOrderId} déclarée livrée sans code de livraison généré au préalable.`);
      } else if (!deliveryCode || deliveryCode.trim() !== shopOrder.deliveryCode) {
        throw new BadRequestException(
          "Code de livraison incorrect ou manquant — demandez-le à l'acheteur avant de déclarer la livraison.",
        );
      }
    }

    // Typé explicitement en Prisma.PrismaPromise<any>[] (plutôt que laissé à
    // l'inférence) car des opérations de types différents (variant.update,
    // stockMovement.create) y sont ajoutées plus bas selon le cas — sans
    // cette annotation, le tableau serait figé au type des deux premiers
    // éléments et le push suivant échouerait à la compilation.
    const operations: Prisma.PrismaPromise<any>[] = [
      this.prisma.shopOrder.update({
        where: { id: shopOrderId },
        data: {
          status: newStatus,
          // Généré à l'entrée en transit, consommé (remis à null) une fois
          // la livraison déclarée — jamais régénéré après coup pour ne pas
          // invalider un code déjà communiqué à l'acheteur.
          ...(newStatus === OrderStatus.IN_TRANSIT
            ? { deliveryCode: String(Math.floor(1000 + Math.random() * 9000)) }
            : {}),
          ...(newStatus === OrderStatus.DELIVERED_DECLARED ? { deliveryCode: null } : {}),
        },
      }),
      this.prisma.orderStatusEvent.create({ data: { shopOrderId, status: newStatus } }),
    ];

    // Jusqu'ici PAYMENT_CONFIRMED n'était qu'une étiquette de suivi — le
    // champ OrderPayment.confirmed restait à `false` pour toujours, même une
    // fois ce statut atteint. Corrigé en même temps que l'ajout du second
    // circuit (10 nov. 2026, point 2), où cette étape porte justement la
    // confirmation réelle de l'argent perçu à la livraison.
    if (newStatus === OrderStatus.PAYMENT_CONFIRMED) {
      operations.push(
        this.prisma.orderPayment.updateMany({
          where: { orderId: shopOrder.orderId },
          data: { confirmed: true },
        }),
      );
    }

    // Annulation (demande du 16 oct. 2026, point 4) — le stock avait été
    // décompté dès la création de la commande (ONLINE_SALE_RESERVED), qu'elle
    // soit annulée par la boutique ou par l'acheteur ; sans restitution ici,
    // l'article resterait indisponible à la vente alors qu'aucune commande
    // réelle ne le retient plus.
    //
    // Correctif audit du 16 oct. 2026 : un remboursement (REFUNDED) décompte
    // le même stock qu'une annulation — l'article revient réellement au
    // vendeur — mais ne restituait rien jusqu'ici, laissant l'article
    // indisponible à la vente alors qu'il n'a jamais quitté la boutique
    // (ou y est revenu). Même restitution que CANCELLED.
    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.REFUNDED) {
      for (const line of shopOrder.lines) {
        operations.push(
          this.prisma.variant.update({
            where: { id: line.variantId },
            data: { stockQty: { increment: line.quantity } },
          }),
        );
        operations.push(
          this.prisma.stockMovement.create({
            data: {
              shopId: shopOrder.shopId,
              variantId: line.variantId,
              type: StockMovementType.RETURN_IN,
              quantity: line.quantity,
            },
          }),
        );
      }
    }

    const [updated] = await this.prisma.$transaction(operations);

    // Correctif audit du 16 oct. 2026 : jusqu'ici, seule la boutique était
    // notifiée (notifierBoutiquesCommandeRecue, à la création) — l'acheteur
    // n'apprenait jamais qu'une boutique avait fait avancer sa commande
    // (acceptée, en préparation, en route, livrée, annulée, remboursée...)
    // autrement qu'en revenant manuellement sur /marketplace/commandes.
    const ETAPES_NOTIFIEES_ACHETEUR = new Set<OrderStatus>([
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.PICKED_UP,
      OrderStatus.IN_TRANSIT,
      OrderStatus.DELIVERED_DECLARED,
      OrderStatus.CANCELLED,
      OrderStatus.REFUNDED,
    ]);
    if (ETAPES_NOTIFIEES_ACHETEUR.has(newStatus) && shopOrder.order?.buyerId) {
      const LIBELLES: Partial<Record<OrderStatus, string>> = {
        [OrderStatus.ACCEPTED]: "a accepté votre commande",
        [OrderStatus.PREPARING]: "prépare votre commande",
        [OrderStatus.PICKED_UP]: "a confié votre commande au livreur",
        [OrderStatus.IN_TRANSIT]: "— votre commande est en route",
        [OrderStatus.DELIVERED_DECLARED]: "a déclaré votre commande livrée — confirmez la réception dès qu'elle vous parvient",
        [OrderStatus.CANCELLED]: "a annulé votre commande",
        [OrderStatus.REFUNDED]: "— votre commande a été remboursée",
      };
      // Code de livraison ajouté au message IN_TRANSIT (voir le commentaire
      // de transitionStatus ci-dessus) : c'est le seul canal par lequel
      // l'acheteur l'apprend en dehors de /marketplace/orders/mine.
      const suffixeCode =
        newStatus === OrderStatus.IN_TRANSIT && updated.deliveryCode
          ? ` Code de livraison à donner au livreur à la remise : ${updated.deliveryCode}.`
          : "";
      // Étapes de livraison proprement dites (PICKED_UP/IN_TRANSIT/
      // DELIVERED_DECLARED) reclassées sous LIVRAISON_ETAPE_MISE_A_JOUR le
      // 20 nov. 2026 (réouverture du réseau livreur) — les autres étapes de
      // la commande (acceptée, en préparation, annulée, remboursée) restent
      // AUTRE, ce ne sont pas des étapes de livraison.
      const ETAPES_LIVRAISON = new Set<OrderStatus>([
        OrderStatus.PICKED_UP,
        OrderStatus.IN_TRANSIT,
        OrderStatus.DELIVERED_DECLARED,
      ]);
      await this.notifications.notifierUtilisateurs([shopOrder.order.buyerId], {
        type: ETAPES_LIVRAISON.has(newStatus) ? NotificationType.LIVRAISON_ETAPE_MISE_A_JOUR : NotificationType.AUTRE,
        title: `Commande ${shopOrder.shop.name}`,
        body: `${shopOrder.shop.name} ${LIBELLES[newStatus]}.${suffixeCode}`,
        link: "/marketplace/commandes",
      });
    }

    return updated;
  }

  /**
   * Annulation côté acheteur (demande du 16 oct. 2026, point 4) — jusqu'ici
   * seule la boutique pouvait annuler depuis Gestion ; l'acheteur n'avait
   * aucun moyen d'annuler sa propre commande. Mêmes règles de transition que
   * côté boutique (ALLOWED_TRANSITIONS), donc impossible une fois la
   * préparation commencée (PREPARING et au-delà) — à ce stade, seule la
   * boutique peut encore agir.
   */
  async cancelByBuyer(shopOrderId: string, buyerId: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { order: true },
    });
    if (shopOrder.order.buyerId !== buyerId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    // `shopOrder.shopId` vient de l'enregistrement déjà chargé ci-dessus et
    // dont la propriété par `buyerId` vient d'être vérifiée — pas d'IDOR
    // possible ici, juste la forme exigée par transitionStatus.
    return this.transitionStatus(shopOrder.shopId, shopOrderId, OrderStatus.CANCELLED);
  }

  /**
   * Confirmation de réception par l'acheteur — un événement distinct de la
   * déclaration de livraison par le livreur (prompt §46). L'absence de
   * réponse ne doit jamais devenir automatiquement une preuve de réception :
   * ce endpoint n'est JAMAIS appelé automatiquement, seulement par l'acheteur.
   */
  async confirmReceipt(shopOrderId: string, buyerId: string) {
    const shopOrder = await this.prisma.shopOrder.findUniqueOrThrow({
      where: { id: shopOrderId },
      include: { order: true },
    });
    if (shopOrder.order.buyerId !== buyerId) {
      throw new ForbiddenException("Cette commande ne vous appartient pas.");
    }
    if (shopOrder.status !== OrderStatus.DELIVERED_DECLARED) {
      throw new BadRequestException("Cette commande n'a pas encore été déclarée livrée par le livreur.");
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.shopOrder.update({
        where: { id: shopOrderId },
        data: { status: OrderStatus.RECEIVED_CONFIRMED },
      }),
      this.prisma.orderStatusEvent.create({
        data: { shopOrderId, status: OrderStatus.RECEIVED_CONFIRMED },
      }),
    ]);

    // Comptabilisée une seule fois, à la réception confirmée (voir
    // docs/ARCHITECTURE_FINANCE.md §8bis.3) — gardée par l'unicité
    // [scope, shopId, sourceType, sourceId] côté AccountingService, donc un
    // retour en arrière puis une nouvelle confirmation ne duplique rien.
    await this.accounting.postShopOrderReceived(updated, shopOrder.order.currency).catch((err) => {
      this.logger.error(`ACCOUNTING_POSTING_FAILED comptabilisation de la commande ${shopOrderId} échouée`, err);
    });

    return updated;
  }

  /**
   * Paiement échelonné (26 nov. 2026) — marque une tranche comme reçue par
   * la boutique. Volontairement un simple geste (pas de preuve de paiement
   * à déposer) : les commandes Marketplace n'ont jamais eu ce mécanisme
   * (voir le commentaire sur EchelonnementTranche dans schema.prisma),
   * c'est la même confirmation manuelle que `transitionStatus` pratique
   * déjà pour le reste d'une commande. `findFirstOrThrow` avec la chaîne
   * complète (tranche -> échéancier -> sous-commande -> shopId) empêche
   * qu'une boutique marque payée la tranche d'une autre boutique en
   * devinant/énumérant un id (même précaution IDOR que transitionStatus).
   */
  async marquerTranchePayee(shopId: string, shopOrderId: string, echelonnementId: string, trancheId: string, userId: string) {
    const tranche = await this.prisma.echelonnementTranche.findFirstOrThrow({
      where: {
        id: trancheId,
        echelonnementId,
        echelonnement: { shopOrderId, shopOrder: { shopId } },
      },
    });
    if (tranche.statut === "PAYEE") {
      return tranche;
    }
    return this.prisma.echelonnementTranche.update({
      where: { id: tranche.id },
      data: { statut: "PAYEE", paidAt: new Date(), markedPaidByUserId: userId },
    });
  }
}
