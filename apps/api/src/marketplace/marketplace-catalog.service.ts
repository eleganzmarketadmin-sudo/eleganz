import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SearchProductsDto } from "./dto/search-products.dto";
import { BoostCible, BoostStatus } from "@eleganz/database";

/**
 * Champs d'une variante sûrs à exposer publiquement (20 oct. 2026, correctif
 * d'audit de lancement). Avant ce correctif, `include: { variants: ... }`
 * sans `select` renvoyait TOUS les champs du modèle Prisma, y compris
 * `costPrice` (prix d'achat) et `coutMoyenPondere` (CUMP) — alors que
 * schema.prisma documente explicitement que `costPrice` ne doit "jamais
 * être exposé aux autres vendeurs", a fortiori pas au grand public. N'importe
 * quel visiteur pouvait lire la marge de chaque boutique dans la réponse
 * JSON brute du marketplace, même si l'écran ne l'affichait pas.
 */
const VARIANT_PUBLIC_SELECT = {
  id: true,
  sku: true,
  size: true,
  color: true,
  sellPrice: true,
  compareAtPrice: true,
  currency: true,
  stockQty: true,
  // Prix de gros par palier (2 nov. 2026) — information de tarification
  // publique au même titre que sellPrice/compareAtPrice, nécessaire côté
  // vitrine pour afficher "à partir de 10 pièces : X $" et calculer le total
  // du panier au bon prix avant la commande.
  priceTiers: { select: { minQuantity: true, unitPrice: true }, orderBy: { minQuantity: "asc" } },
} as const;

@Injectable()
export class MarketplaceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchProductsDto) {
    const [produits, paiementEchelonneActifGlobalement] = await Promise.all([
      this.prisma.product.findMany({
        where: {
          isPublished: true,
          shop: {
            isPubliclyListed: true,
            status: { in: ["FREE_PERIOD", "ACTIVE"] },
            // Filtre "livre chez moi" (prompt du 15 oct. 2026) — ne garde que
            // les boutiques ayant déclaré cette ville comme zone de livraison.
            ...(dto.cityId ? { deliveryZones: { some: { cityId: dto.cityId } } } : {}),
            // Filtre "page boutique publique" (prompt du 15 oct. 2026, point 6).
            ...(dto.shopSlug ? { slug: dto.shopSlug } : {}),
          },
          // Insensible à la casse (12 nov. 2026, retour client) — défensif :
          // le référentiel ProductCategory impose la casse exacte à la
          // création, mais rien n'empêche un ancien produit ou une future
          // intégration externe d'écrire la même catégorie avec une casse
          // différente ; autant que le filtre la retrouve quand même.
          ...(dto.category ? { category: { equals: dto.category, mode: "insensitive" } } : {}),
          ...(dto.q
            ? {
                OR: [
                  { name: { contains: dto.q, mode: "insensitive" } },
                  { description: { contains: dto.q, mode: "insensitive" } },
                ],
              }
            : {}),
          variants: {
            some: {
              stockQty: { gt: 0 },
              ...(dto.size ? { size: dto.size } : {}),
              ...(dto.color ? { color: dto.color } : {}),
              ...(dto.minPrice != null ? { sellPrice: { gte: dto.minPrice } } : {}),
              ...(dto.maxPrice != null ? { sellPrice: { lte: dto.maxPrice } } : {}),
            },
          },
        },
        include: {
          variants: { where: { stockQty: { gt: 0 } }, select: VARIANT_PUBLIC_SELECT },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              deliveryZones: { include: { country: true, city: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.estPaiementEchelonneActifGlobalement(),
    ]);

    // Masquage AVANT le tri de priorité Boost (pas après) : évite de
    // chaîner deux appels génériques l'un dans l'autre (ce qui, avec le
    // client Prisma non régénéré de ce bac à sable, fait perdre à TS le
    // type réel de `produits` au profit de la seule contrainte générique
    // de `appliquerPrioriteBoost`) — `id`/`shopId`, dont elle a besoin,
    // sont inchangés par le masquage.
    const masques = this.masquerPaiementEchelonneSiDesactive(produits, paiementEchelonneActifGlobalement);
    return this.appliquerPrioriteBoost(masques);
  }

  /**
   * Boost payant (26 nov. 2026, décision propriétaire : "remonte dans le tri
   * du catalogue/recherche", sans badge visuel) — remonte en tête tout
   * produit dont l'id EST boosté, ou dont la boutique entière EST boostée,
   * sans toucher au tri `createdAt desc` existant à l'intérieur de chaque
   * groupe (Array.prototype.sort est stable en V8/Node).
   *
   * Comparaison en direct sur `endsAt > now`, jamais sur `Boost.status` seul
   * (même principe "dérivé à la lecture" déjà appliqué à `Invoice.OVERDUE`) :
   * un boost qui vient d'expirer à l'instant ne doit jamais rester pris en
   * compte juste parce que le cron quotidien n'est pas encore repassé.
   */
  private async appliquerPrioriteBoost<T extends { id: string; shopId: string }>(
    produits: T[],
  ): Promise<T[]> {
    if (produits.length === 0) return produits;

    const maintenant = new Date();
    const [produitsBoostes, boutiquesBoostees] = await Promise.all([
      this.prisma.boost.findMany({
        where: { cible: BoostCible.PRODUIT, status: BoostStatus.ACTIF, endsAt: { gt: maintenant } },
        select: { productId: true },
      }),
      this.prisma.boost.findMany({
        where: { cible: BoostCible.BOUTIQUE, status: BoostStatus.ACTIF, endsAt: { gt: maintenant } },
        select: { shopId: true },
      }),
    ]);

    if (produitsBoostes.length === 0 && boutiquesBoostees.length === 0) return produits;

    const idsProduitsBoostes = new Set(produitsBoostes.map((b) => b.productId));
    const idsBoutiquesBoostees = new Set(boutiquesBoostees.map((b) => b.shopId));
    const estBooste = (p: T) => idsProduitsBoostes.has(p.id) || idsBoutiquesBoostees.has(p.shopId);

    return [...produits].sort((a, b) => Number(estBooste(b)) - Number(estBooste(a)));
  }

  async findPublished(productId: string) {
    const [produit, paiementEchelonneActifGlobalement] = await Promise.all([
      this.prisma.product.findFirstOrThrow({
        where: { id: productId, isPublished: true, shop: { isPubliclyListed: true } },
        include: {
          variants: { select: VARIANT_PUBLIC_SELECT },
          shop: {
            select: {
              id: true,
              name: true,
              slug: true,
              deliveryZones: { include: { country: true, city: true } },
            },
          },
        },
      }),
      this.estPaiementEchelonneActifGlobalement(),
    ]);
    return this.masquerPaiementEchelonneSiDesactive([produit], paiementEchelonneActifGlobalement)[0];
  }

  /**
   * Paiement échelonné (26 nov. 2026) — interrupteur global, voir le
   * commentaire sur PlatformSettings.paiementEchelonneActivePlateforme dans
   * schema.prisma. Lu directement ici (sans passer par
   * AdminSettingsService.get(), qui CRÉE la ligne si elle est absente) :
   * cette lecture est publique et à fort trafic (toute visite du
   * catalogue/fiche produit), pas la peine de provoquer une écriture en
   * base pour ça — `false` par défaut si la ligne n'existe pas encore
   * (même valeur que le défaut du schéma).
   */
  private async estPaiementEchelonneActifGlobalement(): Promise<boolean> {
    const reglages = await this.prisma.platformSettings.findUnique({
      where: { id: "platform" },
      select: { paiementEchelonneActivePlateforme: true },
    });
    return reglages?.paiementEchelonneActivePlateforme ?? false;
  }

  /**
   * Coupe-circuit (même principe que partout ailleurs pour ce chantier) :
   * si l'interrupteur global est désactivé, le Marketplace ne doit JAMAIS
   * laisser croire qu'un article est payable en tranches — même si la
   * boutique a réglé l'option sur cet article. Le réglage reste en base,
   * intact, prêt à redevenir visible dès que l'admin réactive
   * l'interrupteur ; on ne fait ici que masquer la réponse publique.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voir le
  // commentaire ci-dessus : signature volontairement non générique pour ne
  // pas enchaîner deux fonctions à contrainte générique (appliquerPrioriteBoost
  // + celle-ci) sur une donnée Prisma non typée dans ce bac à sable, ce qui
  // fait perdre à TS la vraie forme de l'objet au profit de la seule
  // contrainte générique de l'appel le plus imbriqué — sans effet en
  // production une fois le client Prisma régénéré (la forme réelle des
  // objets ne change pas, seule l'annotation locale est assouplie).
  private masquerPaiementEchelonneSiDesactive(produits: any[], actifGlobalement: boolean): any[] {
    if (actifGlobalement) return produits;
    return produits.map((p) => ({
      ...p,
      paiementEchelonneActif: false,
      paiementEchelonneNombreTranches: null,
      paiementEchelonneTauxInteretPct: null,
    }));
  }
}
