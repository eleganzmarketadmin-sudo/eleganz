"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import { formatMoney } from "../../../lib/money";
import styles from "./page.module.css";

const MODES = [
  {
    valeur: "PRIVATE" as const,
    cleTitre: "boutique_modePriveeTitre",
    cleDescription: "boutique_modePriveeDescription",
  },
  {
    valeur: "HYBRID" as const,
    cleTitre: "boutique_modeHybrideTitre",
    cleDescription: "boutique_modeHybrideDescription",
  },
];

// Mêmes clés de fonctionnalités que /admin/tarifs — réutilisées ici pour ne
// pas dupliquer les libellés (19 oct. 2026, page de présentation des
// bouquets à la création). maxEquipe est affiché séparément, pas comme une
// puce de fonctionnalité.
//
// 20 oct. 2026 (demande : "la liste des menus/fonctionnalités ne sont pas
// exhaustifs, exemple dossier crédit") — dossier de crédit, business plan,
// prêts et rapport annuel sont désormais 4 clés de bouquet indépendantes
// côté API (séparées de "financeAvancee", voir finance.controller.ts et
// subscription-plans.service.ts) : chaque bouquet peut les inclure ou non
// séparément depuis le Centre de pilotage, donc chacune a sa propre ligne
// ici plutôt que d'être entassée dans la puce générique "Finance avancée".
const CLES_FONCTIONNALITES_GESTION: { cle: string; cleTrad: string }[] = [
  { cle: "financeAvancee", cleTrad: "admtarifs_gestion_financeAvancee" },
  { cle: "dossierCredit", cleTrad: "admtarifs_gestion_dossierCredit" },
  { cle: "businessPlan", cleTrad: "admtarifs_gestion_businessPlan" },
  { cle: "prets", cleTrad: "admtarifs_gestion_prets" },
  { cle: "rapportAnnuel", cleTrad: "admtarifs_gestion_rapportAnnuel" },
  { cle: "immobilisations", cleTrad: "admtarifs_gestion_immobilisations" },
  { cle: "cloture", cleTrad: "admtarifs_gestion_cloture" },
  { cle: "tresorerie", cleTrad: "admtarifs_gestion_tresorerie" },
  { cle: "comptableExterne", cleTrad: "admtarifs_gestion_comptableExterne" },
  { cle: "variantesProduits", cleTrad: "admtarifs_gestion_variantesProduits" },
  { cle: "exportExcelPdf", cleTrad: "admtarifs_gestion_exportExcelPdf" },
  { cle: "comptabiliteSyscohada", cleTrad: "admtarifs_gestion_comptabiliteSyscohada" },
];

interface Bouquet {
  id: string;
  name: string;
  tagline?: string | null;
  openingFee: string;
  monthlyPrice: string;
  maxActiveProducts: number | null;
  featuresJson: Record<string, unknown>;
}

export default function NouvelleBoutiquePage() {
  const { user, loading: authLoading } = useAuth();
  const { reload } = useShop();
  const { t } = useLocale();
  const router = useRouter();

  const [etape, setEtape] = useState<"bouquet" | "formulaire">("bouquet");
  const [bouquets, setBouquets] = useState<Bouquet[]>([]);
  const [chargementBouquets, setChargementBouquets] = useState(true);
  const [erreurBouquets, setErreurBouquets] = useState<string | null>(null);
  const [bouquetChoisiId, setBouquetChoisiId] = useState<string | null>(null);

  const [nom, setNom] = useState("");
  const [mode, setMode] = useState<"PRIVATE" | "HYBRID">("PRIVATE");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/connexion");
  }, [authLoading, user, router]);

  useEffect(() => {
    api
      .get<Bouquet[]>("/billing/plans?category=GESTION", false)
      .then((liste) => {
        setBouquets(liste);
        // Présélectionne le moins cher, pour que "Continuer" fonctionne
        // même si le propriétaire ne clique sur aucune carte — même
        // comportement par défaut que l'ancienne assignation automatique.
        if (liste.length > 0) setBouquetChoisiId(liste[0].id);
      })
      .catch((err) => setErreurBouquets(err instanceof Error ? err.message : t("boutique_bouquetErreurChargement")))
      .finally(() => setChargementBouquets(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      await api.post("/shops", { name: nom, mode, gestionBouquetId: bouquetChoisiId ?? undefined });
      reload();
      router.push("/caisse");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("boutique_erreurCreation"));
    } finally {
      setEnCours(false);
    }
  }

  if (authLoading || !user) return null;

  if (etape === "bouquet") {
    return (
      <div className={styles.cadre}>
        <h1 className={styles.titre}>{t("boutique_etapeBouquetTitre")}</h1>
        <p className={styles.sousTitre}>{t("boutique_etapeBouquetSousTitre")}</p>

        <div className={styles.banniereGratuite}>
          <strong>{t("boutique_bannierGratuiteTitre")}</strong>
          <span>{t("boutique_bannierGratuiteTexte")}</span>
        </div>

        {chargementBouquets && <p>{t("boutique_bouquetChargement")}</p>}
        {erreurBouquets && <div className={styles.erreur}>{erreurBouquets}</div>}

        {!chargementBouquets && !erreurBouquets && (
          <div className={styles.bouquets}>
            {bouquets.map((b) => {
              const actif = b.id === bouquetChoisiId;
              const fonctionnalites = CLES_FONCTIONNALITES_GESTION.filter(({ cle }) => b.featuresJson[cle] === true);
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`${styles.carteBouquet} ${actif ? styles.carteBouquetActive : ""}`}
                  onClick={() => setBouquetChoisiId(b.id)}
                >
                  <strong>{b.name}</strong>
                  {b.tagline && <p className={styles.tagline}>{b.tagline}</p>}
                  <p className={styles.prixBouquet}>
                    {formatMoney(Number(b.monthlyPrice))}
                    {t("abonnement_parMois")}
                  </p>
                  {Number(b.openingFee) > 0 && (
                    <p className={styles.note}>
                      {t("boutique_fraisOuverture")} : {formatMoney(Number(b.openingFee))}
                    </p>
                  )}
                  {b.maxActiveProducts != null && (
                    <p className={styles.note}>
                      {t("abonnement_produitsMax")} : {b.maxActiveProducts}
                    </p>
                  )}
                  {fonctionnalites.length > 0 && (
                    <ul className={styles.listeFonctionnalites}>
                      {fonctionnalites.map(({ cleTrad }) => (
                        <li key={cleTrad}>{t(cleTrad)}</li>
                      ))}
                    </ul>
                  )}
                  {actif && <span className={styles.badgeChoisi}>{t("abonnement_bouquetActuelBadge")}</span>}
                </button>
              );
            })}
          </div>
        )}

        <button
          className={styles.bouton}
          type="button"
          disabled={!bouquetChoisiId}
          onClick={() => setEtape("formulaire")}
        >
          {t("boutique_continuer")}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("boutique_titre")}</h1>
      <p className={styles.sousTitre}>{t("boutique_sousTitre")}</p>

      <form onSubmit={creer}>
        {erreur && <div className={styles.erreur}>{erreur}</div>}

        <div className={styles.champ}>
          <label htmlFor="nom">{t("boutique_labelNom")}</label>
          <input
            id="nom"
            type="text"
            placeholder={t("boutique_placeholderNom")}
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            minLength={2}
          />
        </div>

        <div className={styles.modes}>
          {MODES.map((m) => (
            <button
              key={m.valeur}
              type="button"
              className={`${styles.modeBouton} ${mode === m.valeur ? styles.modeBoutonActif : ""}`}
              onClick={() => setMode(m.valeur)}
            >
              <strong>{t(m.cleTitre)}</strong>
              <span>{t(m.cleDescription)}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "var(--espace-3)" }}>
          <button className={styles.bouton} type="submit" disabled={enCours || nom.length < 2}>
            {enCours ? t("boutique_creationEnCours") : t("boutique_creerMaBoutique")}
          </button>
          <button
            className={styles.bouton}
            type="button"
            style={{ background: "var(--color-texte-muted)" }}
            onClick={() => setEtape("bouquet")}
          >
            {t("boutique_retourBouquets")}
          </button>
        </div>
      </form>
    </div>
  );
}
