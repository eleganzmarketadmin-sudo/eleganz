"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { RetourLien } from "../../../components/RetourLien";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

type Template = "CLASSIQUE" | "MODERNE" | "CREATIF";
type TypeDocument = "CV" | "DIPLOME" | "CERTIFICATION" | "AUTRE";

interface DocumentExpert {
  id: string;
  type: TypeDocument;
  label: string;
  url: string;
}

interface ReferenceExpert {
  id: string;
  fullName: string;
  role: string | null;
  contact: string;
  note: string | null;
}

interface MonProfilExpert {
  id: string;
  headline: string;
  bio: string;
  domaines: string[];
  conditions: string | null;
  template: Template;
  photoUrl: string | null;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
  statusNote: string | null;
  documents: DocumentExpert[];
  references: ReferenceExpert[];
  user: { fullName: string };
}

interface Engagement {
  id: string;
  scopes: string[];
  shop: { id: string; name: string; slug: string };
}

const TEMPLATES: { valeur: Template; cle: string }[] = [
  { valeur: "CLASSIQUE", cle: "experts_templateClassique" },
  { valeur: "MODERNE", cle: "experts_templateModerne" },
  { valeur: "CREATIF", cle: "experts_templateCreatif" },
];

const TYPES_DOCUMENT: { valeur: TypeDocument; cle: string }[] = [
  { valeur: "CV", cle: "experts_typeCv" },
  { valeur: "DIPLOME", cle: "experts_typeDiplome" },
  { valeur: "CERTIFICATION", cle: "experts_typeCertification" },
  { valeur: "AUTRE", cle: "experts_typeAutre" },
];

// "Devenir expert" / profil personnel (module Experts, 16 oct. 2026, points
// 2 et 3) — n'importe quel compte ELEGANZ peut postuler ; toute
// modification du contenu (titre/présentation/domaines/conditions) repasse
// en attente de modération, mais changer uniquement le gabarit visuel ou
// gérer photo/documents/références ne redéclenche pas la modération (voir
// ExpertsService côté API).
export default function MonProfilExpertPage() {
  const { user } = useAuth();
  const { t } = useLocale();

  const [profil, setProfil] = useState<MonProfilExpert | null>(null);
  const [chargement, setChargement] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [domaines, setDomaines] = useState("");
  const [conditions, setConditions] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  const [photoEnCours, setPhotoEnCours] = useState(false);
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);

  const [templateEnCours, setTemplateEnCours] = useState(false);

  const [typeDocument, setTypeDocument] = useState<TypeDocument>("CV");
  const [labelDocument, setLabelDocument] = useState("");
  const [documentEnCours, setDocumentEnCours] = useState(false);
  const [erreurDocument, setErreurDocument] = useState<string | null>(null);

  const [suggestion, setSuggestion] = useState<{ headlineSuggestion: string; bioSuggestion: string } | null>(null);
  const [extractionEnCours, setExtractionEnCours] = useState<string | null>(null);

  const [refNom, setRefNom] = useState("");
  const [refRole, setRefRole] = useState("");
  const [refContact, setRefContact] = useState("");
  const [referenceEnCours, setReferenceEnCours] = useState(false);
  const [erreurReference, setErreurReference] = useState<string | null>(null);

  function recharger() {
    api
      .get<MonProfilExpert | null>("/experts/moi/profil")
      .then((data) => {
        setProfil(data);
        if (data) {
          setHeadline(data.headline);
          setBio(data.bio);
          setDomaines(data.domaines.join(", "));
          setConditions(data.conditions ?? "");
        }
      })
      .finally(() => setChargement(false));
    api
      .get<Engagement[]>("/experts/moi/engagements")
      .then(setEngagements)
      .catch(() => setEngagements([]));
  }

  useEffect(() => {
    if (!user) return;
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    setConfirmation(false);
    try {
      await api.post("/experts/moi/profil", {
        headline: headline.trim(),
        bio: bio.trim(),
        domaines: domaines
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        conditions: conditions.trim() || undefined,
      });
      recharger();
      setConfirmation(true);
      setSuggestion(null);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("experts_erreurCandidature"));
    } finally {
      setEnCours(false);
    }
  }

  async function changerTemplate(valeur: Template) {
    if (!profil) return;
    setTemplateEnCours(true);
    try {
      await api.patch("/experts/moi/template", { template: valeur });
      setProfil((prev) => (prev ? { ...prev, template: valeur } : prev));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("experts_erreurTemplate"));
    } finally {
      setTemplateEnCours(false);
    }
  }

  async function televerserPhoto(fichier: File) {
    setPhotoEnCours(true);
    setErreurPhoto(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/experts/moi/photo/upload-url",
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("experts_erreurEnvoiStockage"));
      await api.post("/experts/moi/photo", { url: publicUrl });
      setProfil((prev) => (prev ? { ...prev, photoUrl: publicUrl } : prev));
    } catch (err) {
      setErreurPhoto(err instanceof ApiError || err instanceof Error ? err.message : t("experts_erreurEnvoiPhoto"));
    } finally {
      setPhotoEnCours(false);
    }
  }

  async function televerserDocument(fichier: File) {
    if (!labelDocument.trim()) {
      setErreurDocument(t("experts_erreurLabelRequis"));
      return;
    }
    setDocumentEnCours(true);
    setErreurDocument(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/experts/moi/documents/upload-url",
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("experts_erreurEnvoiStockage"));
      const document = await api.post<DocumentExpert>("/experts/moi/documents", {
        type: typeDocument,
        label: labelDocument.trim(),
        url: publicUrl,
      });
      setProfil((prev) => (prev ? { ...prev, documents: [...prev.documents, document] } : prev));
      setLabelDocument("");
    } catch (err) {
      setErreurDocument(err instanceof ApiError || err instanceof Error ? err.message : t("experts_erreurEnvoiDocument"));
    } finally {
      setDocumentEnCours(false);
    }
  }

  async function retirerDocument(documentId: string) {
    try {
      await api.delete(`/experts/moi/documents/${documentId}`);
      setProfil((prev) => (prev ? { ...prev, documents: prev.documents.filter((d) => d.id !== documentId) } : prev));
    } catch (err) {
      setErreurDocument(err instanceof ApiError ? err.message : t("experts_erreurSuppressionDocument"));
    }
  }

  async function extraireDepuisCv(documentId: string) {
    setExtractionEnCours(documentId);
    setErreurDocument(null);
    try {
      const resultat = await api.post<{ headlineSuggestion: string; bioSuggestion: string }>(
        `/experts/moi/documents/${documentId}/extraire-cv`,
      );
      setSuggestion(resultat);
    } catch (err) {
      setErreurDocument(err instanceof ApiError ? err.message : t("experts_erreurExtractionCv"));
    } finally {
      setExtractionEnCours(null);
    }
  }

  function appliquerSuggestion() {
    if (!suggestion) return;
    if (suggestion.headlineSuggestion) setHeadline(suggestion.headlineSuggestion);
    if (suggestion.bioSuggestion) setBio(suggestion.bioSuggestion);
    setSuggestion(null);
  }

  async function ajouterReference(e: React.FormEvent) {
    e.preventDefault();
    if (!refNom.trim() || !refContact.trim()) return;
    setReferenceEnCours(true);
    setErreurReference(null);
    try {
      const reference = await api.post<ReferenceExpert>("/experts/moi/references", {
        fullName: refNom.trim(),
        role: refRole.trim() || undefined,
        contact: refContact.trim(),
      });
      setProfil((prev) => (prev ? { ...prev, references: [...prev.references, reference] } : prev));
      setRefNom("");
      setRefRole("");
      setRefContact("");
    } catch (err) {
      setErreurReference(err instanceof ApiError ? err.message : t("experts_erreurAjoutReference"));
    } finally {
      setReferenceEnCours(false);
    }
  }

  async function retirerReference(referenceId: string) {
    try {
      await api.delete(`/experts/moi/references/${referenceId}`);
      setProfil((prev) => (prev ? { ...prev, references: prev.references.filter((r) => r.id !== referenceId) } : prev));
    } catch (err) {
      setErreurReference(err instanceof ApiError ? err.message : t("experts_erreurSuppressionReference"));
    }
  }

  if (!user) {
    return (
      <div className={styles.cadre}>
        <p className={styles.vide}>
          <Link href="/marketplace/compte?retour=/marketplace/experts/moi">{t("experts_seConnecterPourPostuler")}</Link>
        </p>
      </div>
    );
  }

  if (chargement) {
    return <p style={{ padding: "48px" }}>{t("commun_chargement")}</p>;
  }

  const badgeClasse =
    profil?.status === "APPROVED"
      ? styles.badgeApprouve
      : profil?.status === "REJECTED"
        ? styles.badgeRejete
        : profil?.status === "SUSPENDED"
          ? styles.badgeSuspendu
          : styles.badgeEnAttente;

  const libelleStatut =
    profil?.status === "APPROVED"
      ? t("experts_statutApprouve")
      : profil?.status === "REJECTED"
        ? t("experts_statutRejete")
        : profil?.status === "SUSPENDED"
          ? t("experts_statutSuspendu")
          : t("experts_statutEnAttente");

  const initiale = profil?.user.fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={styles.cadre}>
      <RetourLien href="/marketplace/experts" />
      <h1 className={styles.titre}>{t("experts_monProfilTitre")}</h1>
      <p className={styles.sousTitre}>{t("experts_monProfilSousTitre")}</p>

      {profil && (
        <div>
          <span className={`${styles.badge} ${badgeClasse}`}>{libelleStatut}</span>
          {profil.statusNote && <p className={styles.aide}>{profil.statusNote}</p>}
        </div>
      )}

      {profil && (
        <>
          {/* --- Photo de profil --- */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            {profil.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profil.photoUrl} alt="" className={styles.avatarMoi} />
            ) : (
              <div className={styles.avatarMoi}>{initiale}</div>
            )}
            <label className={styles.bouton} style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
              {photoEnCours ? t("experts_enregistrementEnCours") : t("experts_changerPhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                disabled={photoEnCours}
                onChange={(e) => {
                  const fichier = e.target.files?.[0];
                  e.target.value = "";
                  if (fichier) televerserPhoto(fichier);
                }}
              />
            </label>
          </div>
          {erreurPhoto && <div className={styles.erreur}>{erreurPhoto}</div>}

          {/* --- Gabarit de présentation --- */}
          <p style={{ fontWeight: 600, marginBottom: "8px" }}>{t("experts_choisirTemplate")}</p>
          <div className={styles.templates}>
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.valeur}
                type="button"
                className={`${styles.templateCarte} ${profil.template === tpl.valeur ? styles.templateCarteActive : ""}`}
                disabled={templateEnCours}
                onClick={() => changerTemplate(tpl.valeur)}
              >
                {t(tpl.cle)}
              </button>
            ))}
          </div>
          <p className={styles.aide} style={{ marginBottom: "24px" }}>
            <Link href={`/marketplace/experts/${profil.id}`} className={styles.aide} style={{ textDecoration: "underline" }}>
              {t("experts_voirApercu")}
            </Link>
          </p>
        </>
      )}

      <form onSubmit={enregistrer}>
        <div className={styles.champ}>
          <label htmlFor="headline">{t("experts_labelHeadline")}</label>
          <input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} required minLength={3} maxLength={120} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="bio">{t("experts_labelBio")}</label>
          <textarea id="bio" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} maxLength={4000} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="domaines">{t("experts_labelDomaines")}</label>
          <input id="domaines" value={domaines} onChange={(e) => setDomaines(e.target.value)} required placeholder={t("experts_placeholderDomaines")} />
          <p className={styles.aide}>{t("experts_aideDomaines")}</p>
        </div>
        <div className={styles.champ}>
          <label htmlFor="conditions">{t("experts_labelConditions")}</label>
          <textarea id="conditions" rows={4} value={conditions} onChange={(e) => setConditions(e.target.value)} maxLength={4000} />
          <p className={styles.aide}>{t("experts_aideConditionsInformatif")}</p>
        </div>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{t("experts_candidatureEnregistree")}</div>}

        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours ? t("experts_enregistrementEnCours") : profil ? t("experts_mettreAJour") : t("experts_envoyerCandidature")}
        </button>
      </form>

      {profil && (
        <>
          {/* --- CV, diplômes, certifications, autres documents --- */}
          <div className={styles.section}>
            <h2>{t("experts_documentsTitre")}</h2>
            <p className={styles.aide} style={{ marginBottom: "16px" }}>{t("experts_documentsSousTitre")}</p>

            {erreurDocument && <div className={styles.erreur}>{erreurDocument}</div>}

            <div className={styles.ligneAjout}>
              <select className={styles.selectMini} value={typeDocument} onChange={(e) => setTypeDocument(e.target.value as TypeDocument)}>
                {TYPES_DOCUMENT.map((td) => (
                  <option key={td.valeur} value={td.valeur}>
                    {t(td.cle)}
                  </option>
                ))}
              </select>
              <input
                className={styles.inputMini}
                placeholder={t("experts_placeholderLabelDocument")}
                value={labelDocument}
                onChange={(e) => setLabelDocument(e.target.value)}
              />
              <label className={styles.bouton} style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                {documentEnCours ? t("experts_enregistrementEnCours") : t("experts_televerserDocument")}
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  disabled={documentEnCours}
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    e.target.value = "";
                    if (fichier) televerserDocument(fichier);
                  }}
                />
              </label>
            </div>

            {profil.documents.length === 0 ? (
              <p className={styles.vide}>{t("experts_aucunDocument")}</p>
            ) : (
              profil.documents.map((d) => (
                <div className={styles.ligneDocument} key={d.id}>
                  <span>
                    <strong>{t(TYPES_DOCUMENT.find((td) => td.valeur === d.type)?.cle ?? "experts_typeAutre")}</strong> — {d.label}
                  </span>
                  <span style={{ display: "flex", gap: "8px" }}>
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                      {t("experts_voirDocument")}
                    </a>
                    {d.type === "CV" && d.url.toLowerCase().endsWith(".pdf") && (
                      <button
                        type="button"
                        className={styles.retirer}
                        style={{ background: "var(--color-cobalt)" }}
                        disabled={extractionEnCours === d.id}
                        onClick={() => extraireDepuisCv(d.id)}
                      >
                        {extractionEnCours === d.id ? t("experts_extractionEnCours") : t("experts_preremplirDepuisCv")}
                      </button>
                    )}
                    <button type="button" className={styles.retirer} onClick={() => retirerDocument(d.id)}>
                      {t("eq_retirer")}
                    </button>
                  </span>
                </div>
              ))
            )}

            {suggestion && (
              <div className={styles.suggestion}>
                <p style={{ fontWeight: 600, marginBottom: "4px" }}>{t("experts_suggestionTitre")}</p>
                <p className={styles.aide} style={{ marginBottom: "8px" }}>{t("experts_suggestionAide")}</p>
                {suggestion.headlineSuggestion && <p><strong>{t("experts_labelHeadline")} :</strong> {suggestion.headlineSuggestion}</p>}
                {suggestion.bioSuggestion && (
                  <p style={{ marginTop: "8px", whiteSpace: "pre-wrap" }}>
                    <strong>{t("experts_labelBio")} :</strong> {suggestion.bioSuggestion.slice(0, 400)}
                    {suggestion.bioSuggestion.length > 400 ? "…" : ""}
                  </p>
                )}
                <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                  <button type="button" className={styles.bouton} onClick={appliquerSuggestion}>
                    {t("experts_utiliserSuggestion")}
                  </button>
                  <button type="button" className={styles.retirer} onClick={() => setSuggestion(null)}>
                    {t("experts_ignorerSuggestion")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- Personnes de référence --- */}
          <div className={styles.section}>
            <h2>{t("experts_referencesTitre")}</h2>
            <p className={styles.aide} style={{ marginBottom: "16px" }}>{t("experts_referencesSousTitre")}</p>

            {erreurReference && <div className={styles.erreur}>{erreurReference}</div>}

            <form className={styles.ligneAjout} onSubmit={ajouterReference}>
              <input className={styles.inputMini} placeholder={t("experts_placeholderRefNom")} value={refNom} onChange={(e) => setRefNom(e.target.value)} />
              <input className={styles.inputMini} placeholder={t("experts_placeholderRefRole")} value={refRole} onChange={(e) => setRefRole(e.target.value)} />
              <input className={styles.inputMini} placeholder={t("experts_placeholderRefContact")} value={refContact} onChange={(e) => setRefContact(e.target.value)} />
              <button className={styles.bouton} type="submit" disabled={referenceEnCours || !refNom.trim() || !refContact.trim()}>
                {t("experts_ajouterReference")}
              </button>
            </form>

            {profil.references.length === 0 ? (
              <p className={styles.vide}>{t("experts_aucuneReference")}</p>
            ) : (
              profil.references.map((r) => (
                <div className={styles.ligneDocument} key={r.id}>
                  <span>
                    <strong>{r.fullName}</strong>
                    {r.role ? ` — ${r.role}` : ""} — {r.contact}
                  </span>
                  <button type="button" className={styles.retirer} onClick={() => retirerReference(r.id)}>
                    {t("eq_retirer")}
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {profil?.status === "APPROVED" && (
        <div className={styles.section}>
          <h2>{t("experts_mesBoutiquesTitre")}</h2>
          {engagements.length === 0 ? (
            <p className={styles.vide}>{t("experts_aucuneBoutiqueEngagee")}</p>
          ) : (
            engagements.map((e) => (
              <div className={styles.ligne} key={e.id}>
                <span>{e.shop.name}</span>
                <span className={styles.aide}>{e.scopes.join(", ")}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
