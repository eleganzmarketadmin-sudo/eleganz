import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, StockMovementType } from "@eleganz/database";
import { lireClasseurExcel, construireClasseurExcel } from "../common/xlsx.util";

// Ordre de colonnes imposé par la plateforme (prompt du 12 oct. 2026) — le
// même ordre sert à la fois de gabarit à télécharger et de format attendu à
// l'import, pour qu'une boutique puisse exporter son catalogue, le modifier,
// et le réimporter tel quel.
export const ENTETES_IMPORT_PRODUITS = [
  "Nom de l'article",
  "Catégorie",
  "Référence (SKU)",
  "Taille",
  "Couleur",
  "Prix d'achat",
  "Prix de vente",
  "Prix barré (promo, optionnel)",
  "Devise (USD ou CDF)",
  "Stock initial",
];

const EXEMPLE_LIGNES: (string | number)[][] = [
  ["Robe wax bleue", "Robes", "ROB-BLU-M", "M", "Bleu", 8, 15, "", "USD", 10],
  ["Robe wax bleue", "Robes", "ROB-BLU-L", "L", "Bleu", 8, 15, "", "USD", 6],
  ["Foulard soie imprimé", "Accessoires", "FOU-001", "", "Multicolore", 5, 12, 18, "USD", 20],
];

interface LigneImportResultat {
  ligne: number;
  statut: "créé" | "mis à jour" | "erreur";
  message?: string;
  sku?: string;
}

@Injectable()
export class ProductImportService {
  private readonly logger = new Logger(ProductImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 21 oct. 2026 (audit sécurité, fuite d'information) : avant ce correctif,
   * `err.message` était renvoyé tel quel au client pour CHAQUE ligne en
   * échec. Une erreur `BadRequestException` levée par notre propre code de
   * validation (ex. "SKU manquant à la ligne X") est un message métier sûr
   * à afficher ; une erreur Prisma (contrainte unique, type de colonne...)
   * contient le nom réel de colonnes/tables et ne doit jamais partir vers le
   * navigateur — elle est désormais loguée côté serveur et remplacée par un
   * message générique.
   */
  private messagePublicErreurImport(err: unknown): string {
    if (err instanceof BadRequestException) {
      const reponse = err.getResponse();
      return typeof reponse === "string" ? reponse : ((reponse as { message?: string }).message ?? err.message);
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      this.logger.error(`Erreur Prisma pendant l'import Excel (code ${err.code}) : ${err.message}`);
      return err.code === "P2002"
        ? "Cette référence (SKU) existe déjà pour cet article."
        : "Erreur technique lors de l'enregistrement de cette ligne.";
    }
    this.logger.error("Erreur inattendue pendant l'import Excel", err instanceof Error ? err.stack : err);
    return "Erreur inattendue sur cette ligne.";
  }

  genererGabarit(): Buffer {
    return construireClasseurExcel("Articles", ENTETES_IMPORT_PRODUITS, EXEMPLE_LIGNES);
  }

  async exporterProduits(shopId: string): Promise<Buffer> {
    const produits = await this.prisma.product.findMany({
      where: { shopId },
      include: { variants: true },
      orderBy: { createdAt: "asc" },
    });

    const lignes: (string | number)[][] = [];
    for (const produit of produits) {
      if (produit.variants.length === 0) {
        lignes.push([produit.name, produit.category ?? "", "", "", "", "", "", "", ""]);
        continue;
      }
      for (const variante of produit.variants) {
        lignes.push([
          produit.name,
          produit.category ?? "",
          variante.sku,
          variante.size ?? "",
          variante.color ?? "",
          variante.costPrice != null ? Number(variante.costPrice) : "",
          Number(variante.sellPrice),
          variante.compareAtPrice != null ? Number(variante.compareAtPrice) : "",
          variante.currency,
          variante.stockQty,
        ]);
      }
    }

    return construireClasseurExcel("Articles", ENTETES_IMPORT_PRODUITS, lignes);
  }

  /**
   * Import en masse (prompt du 12 oct. 2026) : chaque ligne devient une
   * variante. Les lignes qui partagent le même (nom, catégorie) sont
   * regroupées sous le même article. Une référence (SKU) déjà connue DE CETTE
   * BOUTIQUE est mise à jour (prix, stock) plutôt que dupliquée — permet le
   * cycle export → modification → réimport. Une référence utilisée par une
   * AUTRE boutique est refusée (SKU unique sur toute la plateforme) : on
   * signale l'erreur ligne par ligne plutôt que de faire échouer tout le
   * fichier, pour qu'une seule ligne fautive ne bloque pas les 200 autres.
   */
  async importerProduits(shopId: string, buffer: Buffer): Promise<{
    resultats: LigneImportResultat[];
    creees: number;
    misesAJour: number;
    erreurs: number;
  }> {
    const lignes = lireClasseurExcel(buffer);
    if (lignes.length < 2) {
      throw new BadRequestException(
        "Le fichier est vide ou ne contient que l'en-tête. Téléchargez le gabarit et remplissez-le à partir de la ligne 2.",
      );
    }

    const resultats: LigneImportResultat[] = [];
    // Cache des articles déjà créés/trouvés pendant cet import, par
    // "nom|catégorie" en minuscules — pour regrouper plusieurs lignes du même
    // article sans relire la base à chaque ligne.
    const articlesParClef = new Map<string, string>();

    // Limite de catalogue du bouquet Gestion (20 oct. 2026, audit de
    // lancement) — l'API bloque déjà la création d'un produit au-delà de
    // `maxActiveProducts` via CatalogService.createProduct, mais l'import
    // Excel créait ses produits directement par `tx.product.create` sans
    // jamais passer par cette vérification : une boutique au bouquet
    // Starter pouvait dépasser sa limite d'un coup avec un gros fichier.
    // On lit la limite une fois, puis on suit le compte courant (produits
    // déjà en base + ceux créés pendant CET import) à chaque nouvelle ligne
    // qui créerait un article inédit.
    const shop = await this.prisma.shop.findUnique({
      where: { id: shopId },
      select: { gestionBouquet: { select: { name: true, maxActiveProducts: true } } },
    });
    const maxProduits = shop?.gestionBouquet?.maxActiveProducts ?? null;
    let nombreProduitsActuel =
      typeof maxProduits === "number" ? await this.prisma.product.count({ where: { shopId } }) : 0;

    for (let i = 1; i < lignes.length; i++) {
      const numeroLigne = i + 1; // numéro visible dans Excel (1 = en-tête)
      const ligne = lignes[i];
      const [nom, categorie, sku, taille, couleur, prixAchatTxt, prixVenteTxt, prixBarreTxt, deviseTxt, stockTxt] = [
        ligne[0] ?? "",
        ligne[1] ?? "",
        ligne[2] ?? "",
        ligne[3] ?? "",
        ligne[4] ?? "",
        ligne[5] ?? "",
        ligne[6] ?? "",
        ligne[7] ?? "",
        ligne[8] ?? "",
        ligne[9] ?? "",
      ];

      if (!nom && !sku) continue; // ligne vide égarée

      if (!nom) {
        resultats.push({ ligne: numeroLigne, statut: "erreur", message: "Le nom de l'article est obligatoire." });
        continue;
      }
      if (!sku) {
        resultats.push({ ligne: numeroLigne, statut: "erreur", message: "La référence (SKU) est obligatoire." });
        continue;
      }
      const prixVente = Number(String(prixVenteTxt).replace(",", "."));
      if (!prixVenteTxt || Number.isNaN(prixVente) || prixVente < 0) {
        resultats.push({
          ligne: numeroLigne,
          statut: "erreur",
          sku,
          message: "Le prix de vente est obligatoire et doit être un nombre.",
        });
        continue;
      }
      const prixAchat = prixAchatTxt ? Number(String(prixAchatTxt).replace(",", ".")) : null;
      if (prixAchatTxt && Number.isNaN(prixAchat)) {
        resultats.push({ ligne: numeroLigne, statut: "erreur", sku, message: "Le prix d'achat doit être un nombre." });
        continue;
      }
      // Prix barré (promo) — même règle que l'API (updateVariant/addVariant,
      // incident du 20 oct. 2026) : jamais inférieur ou égal au prix de
      // vente, et jamais enregistré en silence si invalide. Une cellule
      // vide = pas de promo (null), jamais "0" implicite.
      const prixBarre = prixBarreTxt ? Number(String(prixBarreTxt).replace(",", ".")) : null;
      if (prixBarreTxt && Number.isNaN(prixBarre)) {
        resultats.push({ ligne: numeroLigne, statut: "erreur", sku, message: "Le prix barré (promo) doit être un nombre." });
        continue;
      }
      if (prixBarre != null && prixBarre <= prixVente) {
        resultats.push({
          ligne: numeroLigne,
          statut: "erreur",
          sku,
          message: `Le prix barré (${prixBarre}) doit être strictement supérieur au prix de vente (${prixVente}).`,
        });
        continue;
      }
      const devise = (deviseTxt || "USD").toUpperCase();
      if (!["USD", "CDF"].includes(devise)) {
        resultats.push({
          ligne: numeroLigne,
          statut: "erreur",
          sku,
          message: `Devise "${deviseTxt}" invalide — utilisez USD ou CDF.`,
        });
        continue;
      }
      const stock = stockTxt ? Number(stockTxt) : 0;
      if (stockTxt && (Number.isNaN(stock) || stock < 0)) {
        resultats.push({ ligne: numeroLigne, statut: "erreur", sku, message: "Le stock initial doit être un nombre positif." });
        continue;
      }

      try {
        // eslint-disable-next-line no-await-in-loop
        const resultat = await this.prisma.$transaction(async (tx) => {
          const existante = await tx.variant.findUnique({ where: { sku }, include: { product: true } });

          if (existante && existante.product.shopId !== shopId) {
            throw new Error(`La référence "${sku}" est déjà utilisée par une autre boutique.`);
          }

          if (existante) {
            const ancienStock = existante.stockQty;
            const variante = await tx.variant.update({
              where: { id: existante.id },
              data: {
                size: taille || null,
                color: couleur || null,
                costPrice: prixAchat,
                sellPrice: prixVente,
                compareAtPrice: prixBarre,
                currency: devise,
                stockQty: stock,
              },
            });
            if (stock !== ancienStock) {
              await tx.stockMovement.create({
                data: {
                  shopId,
                  variantId: variante.id,
                  type: StockMovementType.ADJUSTMENT,
                  quantity: stock - ancienStock,
                  reference: "import_excel",
                },
              });
            }
            // Le nom/catégorie de l'article peuvent aussi avoir changé dans le fichier.
            await tx.product.update({
              where: { id: existante.productId },
              data: { name: nom, category: categorie || null },
            });
            return { statut: "mis à jour" as const };
          }

          const clef = `${nom.toLowerCase()}|${categorie.toLowerCase()}`;
          let produitId = articlesParClef.get(clef);
          if (!produitId) {
            const produitExistant = await tx.product.findFirst({
              where: { shopId, name: nom, category: categorie || null },
            });
            if (produitExistant) {
              produitId = produitExistant.id;
            } else {
              if (typeof maxProduits === "number" && nombreProduitsActuel >= maxProduits) {
                throw new Error(
                  `Le bouquet ${shop?.gestionBouquet?.name ?? "actuel"} de cette boutique est limité à ${maxProduits} produit(s) — limite atteinte, cette ligne crée un nouvel article. Passez à un bouquet supérieur depuis le Centre de pilotage pour en ajouter.`,
                );
              }
              const nouveau = await tx.product.create({
                data: { shopId, name: nom, category: categorie || null },
              });
              produitId = nouveau.id;
              nombreProduitsActuel += 1;
            }
            articlesParClef.set(clef, produitId);
          }

          const variante = await tx.variant.create({
            data: {
              productId: produitId,
              sku,
              size: taille || null,
              color: couleur || null,
              costPrice: prixAchat,
              sellPrice: prixVente,
              compareAtPrice: prixBarre,
              currency: devise,
              stockQty: stock,
            },
          });
          if (stock > 0) {
            await tx.stockMovement.create({
              data: {
                shopId,
                variantId: variante.id,
                type: StockMovementType.ADJUSTMENT,
                quantity: stock,
                reference: "import_excel",
              },
            });
          }
          return { statut: "créé" as const };
        });

        resultats.push({ ligne: numeroLigne, statut: resultat.statut, sku });
      } catch (err) {
        resultats.push({
          ligne: numeroLigne,
          statut: "erreur",
          sku,
          message: this.messagePublicErreurImport(err),
        });
      }
    }

    return {
      resultats,
      creees: resultats.filter((r) => r.statut === "créé").length,
      misesAJour: resultats.filter((r) => r.statut === "mis à jour").length,
      erreurs: resultats.filter((r) => r.statut === "erreur").length,
    };
  }
}
