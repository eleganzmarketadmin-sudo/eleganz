"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { ChampQuantite } from "../../components/ChampQuantite";
import { ScannerCodeBarre } from "../../components/ScannerCodeBarre";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import { ajouterOperation } from "../../lib/offline-queue";
import { useOfflineSync } from "../../lib/offline-sync";
import { useExchangeRate } from "../../lib/exchange-rate";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Variant {
  id: string;
  sku: string;
  // Code-barres/QR du fabricant (21 nov. 2026, demande : "scanner un article
  // à la caisse... comme dans les supermarchés"), facultatif — voir le
  // commentaire sur Variant.barcode dans schema.prisma.
  barcode?: string | null;
  size?: string | null;
  color?: string | null;
  sellPrice: string;
  costPrice?: string | null;
  currency: string;
  stockQty: number;
}

interface Product {
  id: string;
  name: string;
  category?: string | null;
  // Déjà renvoyée par GET /shops/:id/products (même objet Product que le
  // Catalogue) — seulement absente ici auparavant du côté affichage caisse.
  images?: string[];
  variants: Variant[];
}

interface LigneTicket {
  variantId?: string;
  label: string;
  quantity: number;
  unitPrice: number;
  currency: string;
  // Prix catalogue au moment de l'ajout au ticket — jamais modifié ensuite,
  // sert uniquement de repère pour signaler visuellement un prix négocié et
  // avertir (sans bloquer) si le prix saisi tombe sous le prix de revient.
  // (demande du 13 oct. 2026 : le secteur informel vend rarement au prix
  // affiché, le vendeur doit pouvoir ajuster le prix ligne par ligne sans
  // jamais toucher au catalogue.)
  prixCatalogue: number;
  prixRevient?: number | null;
}

const MOYENS = [
  { valeur: "CASH", cle: "caisse_moyenEspeces" },
  { valeur: "MOBILE_MONEY", cle: "caisse_moyenMobileMoney" },
] as const;

// Choix du format de document à l'encaissement (demande du 12 oct. 2026,
// n°3 : les deux formats — non homologué et fiscal homologué — doivent être
// proposés au choix). INVOICE_FISCAL n'apparaît que si l'homologation DGI de
// la boutique a été confirmée par l'administration (voir
// fiscalHomologationConfirmed, docs/COMPLIANCE_FACTURE_NORMALISEE.md) ; les
// autres types restent toujours disponibles.
const TYPES_DOCUMENT: { valeur: string; cle: string; reserveHomologation?: boolean }[] = [
  { valeur: "TICKET", cle: "fact_typeTicket" },
  { valeur: "RECEIPT", cle: "fact_typeRecu" },
  { valeur: "INVOICE_INTERNAL", cle: "fact_typeFactureInterne" },
  { valeur: "INVOICE_FISCAL", cle: "caisse_typeFactureFiscaleHomologuee", reserveHomologation: true },
];

function CaisseContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const { rafraichirCompteur, synchroniser } = useOfflineSync();
  const { equivalent } = useExchangeRate();
  const [produits, setProduits] = useState<Product[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [lignes, setLignes] = useState<LigneTicket[]>([]);
  const [moyen, setMoyen] = useState<(typeof MOYENS)[number]["valeur"]>("CASH");
  // Saisie libre client à l'encaissement (19 nov. 2026, demande : "ajouter à
  // la facture les champs optionnels... identité du client et son numéro
  // phone whatsapp"). Entièrement optionnel — PosService associe ou crée
  // automatiquement la fiche ShopCustomer correspondante côté serveur ; la
  // caisse n'a jamais besoin de connaître cette fiche.
  const [clientNom, setClientNom] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [typeDocument, setTypeDocument] = useState<string>("TICKET");
  const [homologationConfirmee, setHomologationConfirmee] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreurVente, setErreurVente] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [dernierTicket, setDernierTicket] = useState<{ shopId: string; documentId: string } | null>(
    null,
  );
  const [impressionEnCours, setImpressionEnCours] = useState(false);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    setChargement(true);
    api
      .get<Product[]>(`/shops/${currentShop.id}/products`)
      .then((data) => {
        if (!annule) setProduits(data);
      })
      .catch((err) => {
        if (!annule) setErreurChargement(err instanceof Error ? err.message : t("cmd_erreurGenerique"));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop]);

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    api
      .get<{
        fiscalHomologationConfirmed: boolean;
        defaultInvoiceType?: "INVOICE_INTERNAL" | "INVOICE_FISCAL" | null;
      }>(`/shops/${currentShop.id}`)
      .then((data) => {
        if (annule) return;
        setHomologationConfirmee(Boolean(data.fiscalHomologationConfirmed));
        // Préférence de la boutique (menu Paramètres, 11 nov. 2026) —
        // pré-sélectionne le type choisi par la boutique à l'ouverture de la
        // caisse, au lieu du TICKET historique. N'applique jamais
        // INVOICE_FISCAL si l'homologation n'est pas confirmée (double
        // vérification : déjà filtré côté service à l'enregistrement, voir
        // ShopsService.updateInvoiceSettings, mais une caisse ne doit jamais
        // dépendre d'une seule vérification pour un sujet fiscal).
        if (
          data.defaultInvoiceType === "INVOICE_INTERNAL" ||
          (data.defaultInvoiceType === "INVOICE_FISCAL" && data.fiscalHomologationConfirmed)
        ) {
          setTypeDocument(data.defaultInvoiceType);
        }
      })
      .catch(() => {
        // Non bloquant pour la caisse : par défaut la facture fiscale reste
        // simplement masquée du choix si cette information est indisponible.
      });
    return () => {
      annule = true;
    };
  }, [currentShop]);

  const typesDisponibles = useMemo(
    () => TYPES_DOCUMENT.filter((td) => !td.reserveHomologation || homologationConfirmee),
    [homologationConfirmee],
  );

  useEffect(() => {
    if (!typesDisponibles.some((td) => td.valeur === typeDocument)) {
      setTypeDocument("TICKET");
    }
  }, [typesDisponibles, typeDocument]);

  const variantesVisibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const sorties: { produit: Product; variante: Variant }[] = [];
    for (const produit of produits) {
      for (const variante of produit.variants) {
        const texte =
          `${produit.name} ${variante.sku} ${variante.barcode ?? ""} ${variante.size ?? ""} ${variante.color ?? ""}`.toLowerCase();
        if (!q || texte.includes(q)) {
          sorties.push({ produit, variante });
        }
      }
    }
    return sorties;
  }, [produits, recherche]);

  const [erreurScan, setErreurScan] = useState<string | null>(null);
  // Scan caméra (21 nov. 2026, retour client : "sur la caisse on ne sait pas
  // lancer la caméra car le bouton scan n'existe pas") — jusqu'ici seule une
  // douchette USB/Bluetooth physique était utilisable (voir plus bas) ; les
  // boutiques sans ce matériel n'avaient aucun moyen de scanner depuis cet
  // écran. Réutilise le même composant caméra que le Catalogue.
  const [scanOuvert, setScanOuvert] = useState(false);

  // Scan code-barres/QR à la caisse (21 nov. 2026, demande : "comme dans les
  // supermarchés... si on branche le dispositif de scan"). Une douchette
  // USB/Bluetooth standard n'a besoin d'aucun pilote ni logiciel particulier :
  // elle se comporte comme un clavier (elle "tape" le code puis Entrée), donc
  // il suffit d'écouter la touche Entrée sur ce même champ de recherche déjà
  // existant. Une correspondance EXACTE (code-barres ou référence) avec un
  // article en stock l'ajoute directement au ticket et vide le champ,
  // fin prêt pour le prochain scan — exactement comme à la caisse d'un
  // supermarché. Si rien ne correspond exactement, rien de plus que la
  // recherche habituelle (aucun changement de comportement pour une saisie
  // manuelle au clavier).
  //
  // Extrait en fonction partagée (21 nov. 2026) pour être réutilisée aussi
  // par le scan caméra ci-dessous : les deux mécanismes doivent se comporter
  // de façon identique une fois le code lu, seule la façon de LIRE le code
  // diffère (clavier émulé par la douchette vs. callback du composant
  // caméra). Retourne `true` si une correspondance exacte a été trouvée
  // (qu'elle ait pu être ajoutée ou non, ex. rupture de stock).
  function traiterCodeScanne(codeBrut: string): boolean {
    const code = codeBrut.trim().toLowerCase();
    if (!code) return false;
    const correspondance = produits
      .flatMap((produit) => produit.variants.map((variante) => ({ produit, variante })))
      .find(
        ({ variante }) =>
          variante.barcode?.trim().toLowerCase() === code || variante.sku.trim().toLowerCase() === code,
      );
    if (!correspondance) return false;
    if (correspondance.variante.stockQty <= 0) {
      setErreurScan(`${correspondance.produit.name} — ${t("caisse_epuise")}`);
      return true;
    }
    setErreurScan(null);
    ajouterVariante(correspondance.produit, correspondance.variante);
    setRecherche("");
    return true;
  }

  function surToucheRecherche(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = recherche.trim();
    if (!code) return;
    if (traiterCodeScanne(code)) {
      e.preventDefault();
    }
  }

  // Code lu par la caméra : même traitement que la douchette ci-dessus. Sans
  // correspondance exacte, le code scanné est placé dans le champ de
  // recherche (comme une saisie manuelle) plutôt que silencieusement perdu —
  // la grille se filtre et le commerçant peut chercher/ajuster à la main.
  function surCodeCameraDetecte(code: string) {
    setScanOuvert(false);
    if (!traiterCodeScanne(code)) {
      setErreurScan(null);
      setRecherche(code);
    }
  }

  const devise = lignes[0]?.currency ?? "USD";
  const total = lignes.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

  function ajouterVariante(produit: Product, variante: Variant) {
    setConfirmation(null);
    setErreurScan(null);
    setLignes((prev) => {
      const existante = prev.find((l) => l.variantId === variante.id);
      if (existante) {
        return prev.map((l) =>
          l.variantId === variante.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          variantId: variante.id,
          label: `${produit.name}${variante.size ? " — " + variante.size : ""}${variante.color ? " " + variante.color : ""}`,
          quantity: 1,
          unitPrice: Number(variante.sellPrice),
          currency: variante.currency,
          prixCatalogue: Number(variante.sellPrice),
          prixRevient: variante.costPrice != null ? Number(variante.costPrice) : null,
        },
      ];
    });
  }

  function modifierQuantite(index: number, quantite: number) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, quantity: Math.max(1, quantite) } : l)),
    );
  }

  function modifierPrix(index: number, prix: number) {
    setLignes((prev) =>
      prev.map((l, i) => (i === index ? { ...l, unitPrice: Math.max(0, prix) } : l)),
    );
  }

  function retirerLigne(index: number) {
    setLignes((prev) => prev.filter((_, i) => i !== index));
  }

  async function encaisser() {
    if (!currentShop || lignes.length === 0) return;
    setEnCours(true);
    setErreurVente(null);
    setDernierTicket(null);

    const payload = {
      lines: lignes.map((l) => ({
        variantId: l.variantId,
        label: l.label,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      payments: [{ method: moyen, amount: total }],
      currency: devise,
      customerName: clientNom.trim() || undefined,
      customerPhone: clientTelephone.trim() || undefined,
    };

    try {
      const vente = await api.post<{ id: string }>(`/shops/${currentShop.id}/pos/sales`, payload);
      setConfirmation(`${t("caisse_venteEnregistree")} ${formatMoney(total, devise)} ${t("caisse_encaisse")}`);
      setLignes([]);
      setClientNom("");
      setClientTelephone("");
      try {
        const document = await api.post<{ id: string }>(
          `/shops/${currentShop.id}/documents/pos-sale/${vente.id}`,
          { type: typeDocument },
        );
        setDernierTicket({ shopId: currentShop.id, documentId: document.id });
      } catch {
        // La vente est enregistrée même si la génération du ticket échoue —
        // ne jamais bloquer l'encaissement pour un problème d'impression.
      }
      return;
    } catch (err) {
      // statusCode === 0 : le serveur est inatteignable (coupure réseau),
      // pas un refus — on bascule sur la file hors-ligne plutôt que de
      // faire perdre la vente au commerçant (docs/ARCHITECTURE_HORS_LIGNE.md).
      if (err instanceof ApiError && err.statusCode === 0) {
        try {
          const clientOperationId =
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await ajouterOperation({
            clientOperationId,
            shopId: currentShop.id,
            type: "POS_SALE",
            payload,
            createdAtClient: new Date().toISOString(),
            tentatives: 0,
          });
          await rafraichirCompteur();
          setConfirmation(
            `${t("caisse_venteEnregistreeHorsLigne")} ${formatMoney(total, devise)}. ${t("caisse_synchroAutomatique")}`,
          );
          setLignes([]);
          setClientNom("");
          setClientTelephone("");
          synchroniser();
        } catch {
          setErreurVente(t("caisse_erreurHorsLigne"));
        }
      } else {
        setErreurVente(err instanceof ApiError ? err.message : t("caisse_erreurEnregistrement"));
      }
    } finally {
      setEnCours(false);
    }
  }

  async function imprimerDernierTicket() {
    if (!dernierTicket) return;
    setImpressionEnCours(true);
    try {
      await ouvrirDocumentPdf(
        `/shops/${dernierTicket.shopId}/documents/${dernierTicket.documentId}/pdf`,
      );
    } catch {
      setErreurVente(t("caisse_erreurOuvertureTicket"));
    } finally {
      setImpressionEnCours(false);
    }
  }

  if (chargement) return <p>{t("caisse_chargementCatalogue")}</p>;
  if (erreurChargement) return <p className={styles.erreur}>{erreurChargement}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_caisse")}</h1>

      <div className={styles.disposition}>
        {/* Panneau articles — plus large, avec son propre défilement : une
            boutique au catalogue de plusieurs milliers d'articles ne doit
            jamais obliger à défiler toute la grille pour atteindre le ticket
            et le bouton d'encaissement, qui restent visibles à côté. */}
        <div className={styles.colonneArticles}>
          <div className={styles.ligneRecherche}>
            <input
              className={styles.recherche}
              type="text"
              placeholder={t("caisse_placeholderRecherche")}
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setErreurScan(null);
              }}
              onKeyDown={surToucheRecherche}
              // Toujours au clavier après l'ajout d'un article au ticket (scan
              // ou clic) : une douchette tape dans le champ qui a le focus, et
              // une caisse continue d'enchaîner les scans sans jamais devoir
              // recliquer dans ce champ entre deux articles.
              autoFocus
            />
            {/* Bouton scan caméra (21 nov. 2026, retour client : "sur la
                caisse on ne sait pas lancer la caméra car le bouton scan
                n'existe pas") — à côté du champ, comme au Catalogue. */}
            <button
              type="button"
              className={styles.boutonScanCamera}
              onClick={() => setScanOuvert(true)}
              title={t("cat_scanTitre")}
              aria-label={t("cat_scanTitre")}
            >
              📷
            </button>
          </div>
          {scanOuvert && (
            <ScannerCodeBarre onFermer={() => setScanOuvert(false)} onDetecte={surCodeCameraDetecte} />
          )}
          {/* Rendre le scan visible (21 nov. 2026, retour client : « le champ
              ou zone ajouté à la caisse lié au code barre ne sont pas
              visible ») — la douchette réutilise ce même champ de recherche
              (voir surToucheRecherche ci-dessus) sans écran séparé, donc rien
              ne signalait qu'elle y était utilisable ; le bouton 📷 ci-dessus
              couvre maintenant aussi les boutiques sans douchette physique. */}
          {erreurScan ? (
            <p className={styles.erreurScan}>⚠ {erreurScan}</p>
          ) : (
            <p className={styles.aideScan}>📷 {t("caisse_aideScan")}</p>
          )}

          <div className={styles.zoneArticles}>
            {variantesVisibles.length === 0 ? (
              <p className={styles.messageVide}>{t("caisse_aucunArticle")}</p>
            ) : (
              <div className={styles.grilleArticles}>
                {variantesVisibles.map(({ produit, variante }) => (
                  <button
                    key={variante.id}
                    className={styles.carteArticle}
                    disabled={variante.stockQty <= 0}
                    onClick={() => ajouterVariante(produit, variante)}
                  >
                    {/* Vignette photo (21 nov. 2026, demande : "rajouter une
                        petite photo de ce produit"). Product.images existait
                        déjà au catalogue — jamais affiché jusqu'ici côté
                        caisse. Un espace réservé neutre remplace l'image
                        quand l'article n'en a aucune, pour que les cartes
                        gardent toutes la même hauteur dans la grille. */}
                    {produit.images && produit.images.length > 0 ? (
                      <img
                        className={styles.carteArticleImage}
                        src={produit.images[0]}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.carteArticleImageVide} aria-hidden="true" />
                    )}
                    <span className={styles.carteArticleNom}>{produit.name}</span>
                    <span className={styles.carteArticleDetail}>
                      {[variante.size, variante.color].filter(Boolean).join(" · ") || variante.sku}
                      {" — "}
                      {variante.stockQty > 0 ? `${variante.stockQty} ${t("caisse_enStock")}` : t("caisse_epuise")}
                    </span>
                    <span className={styles.carteArticlePrix}>
                      {formatMoney(Number(variante.sellPrice), variante.currency)}
                      {equivalent(Number(variante.sellPrice), variante.currency) && (
                        <span className={styles.carteArticlePrixEquivalent}>
                          {" "}
                          {equivalent(Number(variante.sellPrice), variante.currency)}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Panneau ticket — vertical, toujours visible à côté de la grille
            (prompt : "disposition verticale... comme un panneau"). */}
        <div className={styles.colonneTicket}>
          <div className={styles.ticket}>
            {lignes.length === 0 ? (
              <p className={styles.messageVide}>{t("caisse_ticketVide")}</p>
            ) : (
              <div className={styles.ligneTicketListe}>
                {lignes.map((ligne, i) => {
                  const prixModifie = ligne.unitPrice !== ligne.prixCatalogue;
                  const sousRevient =
                    ligne.prixRevient != null && ligne.unitPrice < ligne.prixRevient;
                  return (
                    <div className={styles.ligneTicket} key={i}>
                      <span className={styles.ligneTicketNom}>
                        {ligne.label}
                        {prixModifie && (
                          <span
                            className={styles.pucePrixModifie}
                            title={`${t("caisse_prixCatalogue")} ${formatMoney(ligne.prixCatalogue, ligne.currency)}`}
                          >
                            {t("caisse_prixNegocie")}
                          </span>
                        )}
                      </span>
                      <ChampQuantite
                        className={styles.ligneTicketQte}
                        min={1}
                        value={ligne.quantity}
                        onChange={(qte) => modifierQuantite(i, qte)}
                      />
                      <input
                        className={`${styles.ligneTicketPrix} ${prixModifie ? styles.ligneTicketPrixModifie : ""}`}
                        type="number"
                        min={0}
                        step="0.01"
                        value={ligne.unitPrice}
                        title={t("caisse_titrePrixUnitaire")}
                        onChange={(e) => modifierPrix(i, Number(e.target.value))}
                      />
                      <span className={styles.ligneTicketMontant}>
                        {formatMoney(ligne.quantity * ligne.unitPrice, ligne.currency)}
                      </span>
                      <button
                        className={styles.ligneTicketSupprimer}
                        onClick={() => retirerLigne(i)}
                        aria-label={`${t("caisse_retirer")} ${ligne.label}`}
                      >
                        ✕
                      </button>
                      {sousRevient && (
                        <div className={styles.averPrixBas}>
                          ⚠ {t("caisse_prixSousRevient")} ({formatMoney(ligne.prixRevient!, ligne.currency)}) —{" "}
                          {t("caisse_verifiezAvantEncaisser")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.totalLigne}>
              <span>{t("panier_total")}</span>
              <span className="chiffre">
                {formatMoney(total, devise)}
                {equivalent(total, devise) && (
                  <span className={styles.totalLigneEquivalent}> {equivalent(total, devise)}</span>
                )}
              </span>
            </div>

            <div className={styles.paiements}>
              <div className={styles.clientFacultatif}>
                <span className={styles.clientFacultatifTitre}>{t("caisse_clientFacultatif")}</span>
                <div className={styles.clientFacultatifChamps}>
                  <input
                    className={styles.clientChamp}
                    type="text"
                    placeholder={t("caisse_placeholderNomClient")}
                    value={clientNom}
                    onChange={(e) => setClientNom(e.target.value)}
                  />
                  <input
                    className={styles.clientChamp}
                    type="tel"
                    placeholder={t("caisse_placeholderTelephoneClient")}
                    value={clientTelephone}
                    onChange={(e) => setClientTelephone(e.target.value)}
                  />
                </div>
              </div>

              <div className={styles.moyensPaiement}>
                {MOYENS.map((m) => (
                  <button
                    key={m.valeur}
                    className={`${styles.moyenBouton} ${moyen === m.valeur ? styles.moyenBoutonActif : ""}`}
                    onClick={() => setMoyen(m.valeur)}
                  >
                    {t(m.cle)}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                <label htmlFor="typeDocument" style={{ fontSize: "0.85rem" }}>
                  {t("caisse_documentAImprimer")}
                </label>
                <select
                  id="typeDocument"
                  value={typeDocument}
                  onChange={(e) => setTypeDocument(e.target.value)}
                  style={{ padding: "8px 10px", minHeight: 40 }}
                >
                  {typesDisponibles.map((td) => (
                    <option key={td.valeur} value={td.valeur}>
                      {t(td.cle)}
                    </option>
                  ))}
                </select>
              </div>

              {erreurVente && <div className={styles.erreur}>{erreurVente}</div>}
              {confirmation && (
                <div className={styles.confirmation}>
                  {confirmation}
                  {dernierTicket && (
                    <>
                      {" — "}
                      <button
                        onClick={imprimerDernierTicket}
                        disabled={impressionEnCours}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#fff",
                          textDecoration: "underline",
                          cursor: "pointer",
                          padding: 0,
                          font: "inherit",
                        }}
                      >
                        {t("caisse_imprimerTicket")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={styles.barreAction}>
            <button
              className={styles.boutonEncaisser}
              disabled={lignes.length === 0 || enCours}
              onClick={encaisser}
            >
              {enCours ? t("caisse_enregistrementEnCours") : `${t("caisse_enregistrerVente")} — ${formatMoney(total, devise)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CaissePage() {
  return (
    <ProtectedGestionPage>
      <CaisseContent />
    </ProtectedGestionPage>
  );
}
