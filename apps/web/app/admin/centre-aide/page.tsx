"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface GuideArticle {
  id: string;
  slug: string;
  titre: string;
  categorie: string;
  motsCles: string[];
  contenuAgent: string;
  imagesAgent: string[];
  contenuClient: string | null;
  imagesClient: string[];
  partagePublicActif: boolean;
  publicSlug: string | null;
  visibleFaq: boolean;
  updatedAt: string;
}

const FICHE_VIDE = {
  titre: "",
  categorie: "",
  motsCles: "",
  contenuAgent: "",
  imagesAgent: [] as string[],
  contenuClient: "",
  imagesClient: [] as string[],
  partagePublicActif: false,
  visibleFaq: false,
};

// Centre d'aide interne ELEGANZ (10 nov. 2026, demande du propriétaire) :
// les agents ELEGANZ (tous rôles ADMIN_*, voir MenuAdmin.CENTRE_AIDE)
// cherchent "comment faire X" sur la plateforme, ou trouvent une fiche
// pas-à-pas à suivre pour accompagner un client au téléphone/chat.
// Deux contenus séparés par fiche (jamais mélangés) : contenuAgent reste
// toujours interne ; contenuClient est la seule partie qu'un lien public
// peut révéler (partagePublicActif) — voir guides.service.ts côté API.
function CentreAideContent() {
  const { t } = useLocale();
  const [fiches, setFiches] = useState<GuideArticle[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState("");
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [ficheOuverte, setFicheOuverte] = useState<GuideArticle | null>(null);
  const [creation, setCreation] = useState(false);
  const [brouillon, setBrouillon] = useState(FICHE_VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiImage, setEnvoiImage] = useState<"agent" | "client" | null>(null);
  const [lienCopie, setLienCopie] = useState(false);

  function recharger() {
    const params = new URLSearchParams();
    if (recherche.trim()) params.set("q", recherche.trim());
    if (categorieFiltre) params.set("categorie", categorieFiltre);
    api
      .get<GuideArticle[]>(`/admin/guides?${params.toString()}`)
      .then(setFiches)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("commun_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    api.get<string[]>("/admin/guides/categories").then(setCategories).catch(() => {});
  }, []);

  // Recherche "à l'usage" avec un léger délai, plutôt qu'à chaque frappe —
  // évite une requête par caractère tapé tout en restant réactif.
  useEffect(() => {
    const minuteur = setTimeout(recharger, 250);
    return () => clearTimeout(minuteur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recherche, categorieFiltre]);

  function ouvrirFiche(fiche: GuideArticle) {
    setFicheOuverte(fiche);
    setCreation(false);
    setLienCopie(false);
    setBrouillon({
      titre: fiche.titre,
      categorie: fiche.categorie,
      motsCles: fiche.motsCles.join(", "),
      contenuAgent: fiche.contenuAgent,
      imagesAgent: fiche.imagesAgent,
      contenuClient: fiche.contenuClient ?? "",
      imagesClient: fiche.imagesClient,
      partagePublicActif: fiche.partagePublicActif,
      visibleFaq: fiche.visibleFaq,
    });
  }

  function ouvrirCreation() {
    setFicheOuverte(null);
    setCreation(true);
    setLienCopie(false);
    setBrouillon(FICHE_VIDE);
  }

  function fermerDetail() {
    setFicheOuverte(null);
    setCreation(false);
  }

  async function televerserImage(fichier: File, cible: "agent" | "client") {
    setEnvoiImage(cible);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/admin/guides/upload-url",
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("aide_erreurEnvoiStockage"));
      setBrouillon((prev) =>
        cible === "agent"
          ? { ...prev, imagesAgent: [...prev.imagesAgent, publicUrl] }
          : { ...prev, imagesClient: [...prev.imagesClient, publicUrl] },
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("aide_erreurEnvoiStockage"));
    } finally {
      setEnvoiImage(null);
    }
  }

  function retirerImage(cible: "agent" | "client", url: string) {
    setBrouillon((prev) =>
      cible === "agent"
        ? { ...prev, imagesAgent: prev.imagesAgent.filter((u) => u !== url) }
        : { ...prev, imagesClient: prev.imagesClient.filter((u) => u !== url) },
    );
  }

  async function enregistrer() {
    setEnregistrement(true);
    setErreur(null);
    const dto = {
      titre: brouillon.titre,
      categorie: brouillon.categorie,
      motsCles: brouillon.motsCles
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
      contenuAgent: brouillon.contenuAgent,
      imagesAgent: brouillon.imagesAgent,
      contenuClient: brouillon.contenuClient || undefined,
      imagesClient: brouillon.imagesClient,
      partagePublicActif: brouillon.partagePublicActif,
      visibleFaq: brouillon.visibleFaq,
    };
    try {
      if (ficheOuverte) {
        const maj = await api.patch<GuideArticle>(`/admin/guides/${ficheOuverte.id}`, dto);
        setFicheOuverte(maj);
      } else {
        await api.post<GuideArticle>("/admin/guides", dto);
        fermerDetail();
      }
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("commun_erreur"));
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimer() {
    if (!ficheOuverte) return;
    if (!window.confirm(t("aide_confirmerSuppression"))) return;
    try {
      await api.delete(`/admin/guides/${ficheOuverte.id}`);
      fermerDetail();
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("commun_erreur"));
    }
  }

  function copierLien() {
    if (!ficheOuverte?.publicSlug) return;
    const lien = `${window.location.origin}/aide/${ficheOuverte.publicSlug}`;
    navigator.clipboard?.writeText(lien).then(() => {
      setLienCopie(true);
      setTimeout(() => setLienCopie(false), 2500);
    });
  }

  const panneauOuvert = creation || ficheOuverte !== null;

  return (
    <div>
      <h1 className={styles.titre}>{t("aide_titre")}</h1>
      <p className={styles.sousTitre}>{t("aide_sousTitre")}</p>
      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {!panneauOuvert && (
        <>
          <div className={styles.barreOutils}>
            <input
              className={styles.champRecherche}
              placeholder={t("aide_rechercherPlaceholder")}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            <select value={categorieFiltre} onChange={(e) => setCategorieFiltre(e.target.value)}>
              <option value="">{t("aide_toutesCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button className={styles.boutonPrincipal} onClick={ouvrirCreation}>
              + {t("aide_nouvelleFiche")}
            </button>
            <a
              className={styles.boutonSecondaire}
              href="/aide"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("aide_voirFaqPublique")} ↗
            </a>
          </div>

          {chargement ? (
            <p>{t("commun_chargement")}</p>
          ) : fiches.length === 0 ? (
            <p className={styles.messageVide}>{t("aide_aucunResultat")}</p>
          ) : (
            <div className={styles.liste}>
              {fiches.map((f) => (
                <button key={f.id} className={styles.carteFiche} onClick={() => ouvrirFiche(f)}>
                  <span className={styles.carteCategorie}>{f.categorie}</span>
                  <span className={styles.carteTitre}>{f.titre}</span>
                  {f.partagePublicActif && <span className={styles.puceLienPublic}>🔗</span>}
                  {f.visibleFaq && (
                    <span className={styles.puceLienPublic} style={{ right: "var(--espace-6)" }} title={t("aide_visibleFaq")}>
                      ❓
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {panneauOuvert && (
        <div className={styles.panneau}>
          <button className={styles.lienRetour} onClick={fermerDetail}>
            {t("aide_retourListe")}
          </button>

          <label className={styles.champ}>
            {t("aide_champTitre")}
            <input value={brouillon.titre} onChange={(e) => setBrouillon((p) => ({ ...p, titre: e.target.value }))} />
          </label>

          <label className={styles.champ}>
            {t("aide_champCategorie")}
            <input
              value={brouillon.categorie}
              onChange={(e) => setBrouillon((p) => ({ ...p, categorie: e.target.value }))}
              list="aide-categories-existantes"
            />
            <datalist id="aide-categories-existantes">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className={styles.champ}>
            {t("aide_champMotsCles")}
            <input
              value={brouillon.motsCles}
              onChange={(e) => setBrouillon((p) => ({ ...p, motsCles: e.target.value }))}
            />
          </label>

          <div className={styles.section}>
            <h2 className={styles.sectionTitre}>{t("aide_sectionAgent")}</h2>
            <textarea
              className={styles.zoneTexte}
              rows={8}
              value={brouillon.contenuAgent}
              onChange={(e) => setBrouillon((p) => ({ ...p, contenuAgent: e.target.value }))}
            />
            <GalerieImages
              images={brouillon.imagesAgent}
              surEnvoi={(f) => televerserImage(f, "agent")}
              surRetrait={(url) => retirerImage("agent", url)}
              enCours={envoiImage === "agent"}
              t={t}
            />
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitre}>{t("aide_sectionClient")}</h2>
            <textarea
              className={styles.zoneTexte}
              rows={8}
              value={brouillon.contenuClient}
              onChange={(e) => setBrouillon((p) => ({ ...p, contenuClient: e.target.value }))}
            />
            <GalerieImages
              images={brouillon.imagesClient}
              surEnvoi={(f) => televerserImage(f, "client")}
              surRetrait={(url) => retirerImage("client", url)}
              enCours={envoiImage === "client"}
              t={t}
            />

            <label className={styles.caseACocher}>
              <input
                type="checkbox"
                checked={brouillon.partagePublicActif}
                onChange={(e) => setBrouillon((p) => ({ ...p, partagePublicActif: e.target.checked }))}
              />
              {t("aide_partagePublic")}
            </label>

            {ficheOuverte?.publicSlug && (
              <div className={styles.blocLien}>
                <span>{ficheOuverte.partagePublicActif ? t("aide_partagePublicActif") : t("aide_partagePublicInactif")}</span>
                {ficheOuverte.partagePublicActif && (
                  <button className={styles.boutonSecondaire} onClick={copierLien}>
                    {lienCopie ? t("aide_lienCopie") : t("aide_copierLien")}
                  </button>
                )}
              </div>
            )}

            {/* FAQ publique (11 nov. 2026) — distinct du partage individuel
                ci-dessus : coche cette fiche pour qu'elle apparaisse pour
                TOUT visiteur sur /aide, sans lien à transmettre au cas par
                cas. Les deux cases sont indépendantes et peuvent être
                cochées ensemble. */}
            <label className={styles.caseACocher}>
              <input
                type="checkbox"
                checked={brouillon.visibleFaq}
                onChange={(e) => setBrouillon((p) => ({ ...p, visibleFaq: e.target.checked }))}
              />
              {t("aide_visibleFaq")}
            </label>
          </div>

          <div className={styles.actionsPanneau}>
            <button className={styles.boutonPrincipal} disabled={enregistrement} onClick={enregistrer}>
              {t("aide_enregistrer")}
            </button>
            {ficheOuverte && (
              <button className={styles.boutonDanger} onClick={supprimer}>
                {t("aide_supprimer")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GalerieImages({
  images,
  surEnvoi,
  surRetrait,
  enCours,
  t,
}: {
  images: string[];
  surEnvoi: (fichier: File) => void;
  surRetrait: (url: string) => void;
  enCours: boolean;
  t: (cle: string) => string;
}) {
  return (
    <div className={styles.galerie}>
      {images.map((url) => (
        <div key={url} className={styles.vignette}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" />
          <button type="button" onClick={() => surRetrait(url)} aria-label="×">
            ×
          </button>
        </div>
      ))}
      <label className={styles.boutonAjoutImage}>
        {enCours ? t("aide_envoiEnCours") : `+ ${t("aide_ajouterImage")}`}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={enCours}
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (fichier) surEnvoi(fichier);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

export default function CentreAidePage() {
  return (
    <AdminShell>
      <CentreAideContent />
    </AdminShell>
  );
}
