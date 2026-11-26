"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { ZonesLivraison } from "../../components/ZonesLivraison";
import { SECTEURS_ACTIVITE } from "../../lib/secteurs-activite";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { formatMoney, formatDate } from "../../lib/money";
import styles from "./page.module.css";

interface ShopDetails {
  id: string;
  name: string;
  slug: string;
  isPubliclyListed: boolean;
  description?: string | null;
  secteurActivite?: string | null;
  invoiceAddress?: string | null;
  invoicePhone?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceHeaderNote?: string | null;
  invoiceFooterNote?: string | null;
  fiscalHomologationConfirmed: boolean;
  defaultInvoiceType?: "INVOICE_INTERNAL" | "INVOICE_FISCAL" | null;
  // Facture normalisée auto-déclarée (14 nov. 2026) — voir le commentaire du
  // champ Shop.normalisationAutoDeclaree dans schema.prisma : distinct de
  // fiscalHomologationConfirmed, jamais mélangé avec lui.
  normalisationAutoDeclaree?: boolean;
  normalisationAutoDeclareeDepuis?: string | null;
}

// Identité fiscale et juridique de la boutique (14 nov. 2026, demande :
// "AJOUTER les identifications fiscales et juridiques de la boutique dans
// le menu paramètre de chaque boutique") — même forme que Finance > Règles
// fiscales (apps/web/app/(gestion)/finance/regles-fiscales/page.tsx), qui
// reste le lieu d'origine de ces champs ; dupliquée ici pour un accès direct
// depuis Paramètres, avec son propre état et sa propre soumission,
// indépendants du formulaire "documents imprimés" ci-dessous (convention de
// cette page : une section logique = un état et une soumission à elle).
interface IdentiteFiscale {
  fiscalLegalName: string | null;
  fiscalLegalForm: string | null;
  fiscalIdNumber: string | null;
  fiscalAddress: string | null;
  fiscalJurisdiction: string | null;
  fiscalRegime: string | null;
  fiscalExercice: string | null;
  fiscalVatRegistered: boolean;
}

interface Compte {
  fullName: string;
  email: string | null;
  phone: string | null;
}

interface BouquetGestion {
  id: string;
  name: string;
  monthlyPrice: number;
  maxActiveProducts: number | null;
  commissionRate: number | null;
  active: boolean;
}

interface StatutAbonnementGestion {
  planActuel: BouquetGestion | null;
  cycle: { debut: string; renouvellement: string; statut: string } | null;
  catalogue: BouquetGestion[];
}

interface ResultatChangementBouquet {
  nouveauPlan: { id: string; name: string; monthlyPrice: number };
  complement: number;
  renouvellement: string;
}

interface FactureEleganz {
  id: string;
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  reminderStage: number;
  penaltyDays: number | null;
  penaltyAmount: string | null;
}

// Libellé lisible pour chaque nature de facture ELEGANZ (26 nov. 2026,
// ajout de "boost" — voir le même mapping côté admin dans
// admin/factures/page.tsx, kindLabelGetter de la section boutiques).
function libelleKindFacture(kind: string, t: (cle: string) => string): string {
  switch (kind) {
    case "opening_fee":
      return t("admfact_fraisOuverture");
    case "subscription":
      return t("admfact_abonnementMensuel");
    case "commission":
      return t("admfact_kindCommission");
    case "boost":
      return t("admfact_kindBoost");
    default:
      return kind;
  }
}

const CLES_PALIER_FACTURATION: Record<number, string> = {
  1: "admfact_palier1",
  2: "admfact_palier2",
  3: "admfact_palier3",
  4: "admfact_palier4",
  5: "admfact_palier5",
};

/**
 * Sous-section "Facturation ELEGANZ" de l'écran Abonnement (16 nov. 2026,
 * chantier relances/recouvrement, §4 du plan) — jamais une nouvelle page
 * sous `/(gestion)/factures`, qui désigne déjà les documents commerciaux de
 * la boutique vers SES PROPRES clients : ceci concerne la facturation DE la
 * boutique PAR la plateforme (abonnement, commissions), déjà exposée côté
 * API (`GET /shops/:shopId/invoices`) mais jamais consommée côté front
 * avant ce chantier. Permet de voir les factures en attente avec leur
 * palier de relance, et de déposer une preuve de paiement (sine qua non de
 * la réactivation automatique si la boutique est suspendue pour impayé).
 */
function FacturationElegansSection({ shopId, shopStatus }: { shopId: string; shopStatus: string }) {
  const { t } = useLocale();
  const [factures, setFactures] = useState<FactureEleganz[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [preuveOuverte, setPreuveOuverte] = useState<string | null>(null);
  const [noteParFacture, setNoteParFacture] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function recharger() {
    api
      .get<FactureEleganz[]>(`/shops/${shopId}/invoices`)
      .then(setFactures)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("abonnement_erreurChargement")));
  }

  useEffect(recharger, [shopId]);

  async function deposerPreuve(factureId: string, fichier: File) {
    setEnCours(factureId);
    setErreur(null);
    setConfirmation(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/shops/${shopId}/invoices/${factureId}/proof-of-payment/upload-url`,
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("factElg_erreurEnvoiStockage"));
      await api.post(`/shops/${shopId}/invoices/${factureId}/proof-of-payment`, {
        fileUrl: publicUrl,
        note: noteParFacture[factureId] || undefined,
      });
      setConfirmation(t("factElg_preuveDeposee"));
      setPreuveOuverte(null);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("factElg_erreurEnvoiPreuve"));
    } finally {
      setEnCours(null);
    }
  }

  if (factures === null) return <p className={styles.note}>{t("abonnement_chargement")}</p>;

  const enAttente = factures.filter((f) => f.status === "PENDING");
  const historique = factures.filter((f) => f.status !== "PENDING");

  return (
    <div style={{ marginTop: "var(--espace-5)" }}>
      <h3 className={styles.sousTitre}>{t("factElg_titre")}</h3>
      {shopStatus === "SUSPENDED" && <p className={styles.erreur}>{t("factElg_noteSuspendue")}</p>}
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      {enAttente.length === 0 ? (
        <p className={styles.note}>{t("factElg_aucuneFactureEnAttente")}</p>
      ) : (
        enAttente.map((f) => (
          <div key={f.id} className={styles.champ} style={{ border: "1px solid var(--color-border)", borderRadius: "8px", padding: "var(--espace-3)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--espace-3)", alignItems: "center", justifyContent: "space-between" }}>
              <span>
                <strong>{libelleKindFacture(f.kind, t)}</strong> — {formatMoney(Number(f.amount))} · {t("crd_colEcheance")} : {formatDate(f.dueAt)}
                {f.reminderStage > 0 && CLES_PALIER_FACTURATION[f.reminderStage] && (
                  <> · {t(CLES_PALIER_FACTURATION[f.reminderStage])}</>
                )}
              </span>
              <button
                className={styles.bouton}
                type="button"
                onClick={() => setPreuveOuverte(preuveOuverte === f.id ? null : f.id)}
              >
                📎 {t("factElg_deposerPreuve")}
              </button>
            </div>
            {preuveOuverte === f.id && (
              <div style={{ marginTop: "var(--espace-3)", display: "flex", flexDirection: "column", gap: "var(--espace-2)" }}>
                <input
                  type="text"
                  placeholder={t("factElg_notePlaceholder")}
                  value={noteParFacture[f.id] ?? ""}
                  onChange={(e) => setNoteParFacture((prev) => ({ ...prev, [f.id]: e.target.value }))}
                />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={enCours === f.id}
                  onChange={(e) => {
                    const fichier = e.target.files?.[0];
                    if (fichier) deposerPreuve(f.id, fichier);
                  }}
                />
              </div>
            )}
          </div>
        ))
      )}

      <h3 className={styles.sousTitre} style={{ marginTop: "var(--espace-4)" }}>
        {t("factElg_historique")}
      </h3>
      {historique.length === 0 ? (
        <p className={styles.note}>{t("factElg_aucunHistorique")}</p>
      ) : (
        historique.slice(0, 10).map((f) => (
          <div key={f.id} className={styles.champ} style={{ display: "flex", justifyContent: "space-between" }}>
            <span>
              {libelleKindFacture(f.kind, t)} — {formatMoney(Number(f.amount))}
              {f.penaltyAmount && Number(f.penaltyAmount) > 0 && (
                <> · {t("admfact_penalite")} : {formatMoney(Number(f.penaltyAmount))}</>
              )}
            </span>
            <span className={styles.note}>{f.status === "PAID" ? t("admfact_statutPayee") : f.status}</span>
          </div>
        ))
      )}
    </div>
  );
}

interface DocumentIdentite {
  id: string;
  type: "PIECE_IDENTITE_DIRIGEANT" | "REGISTRE_COMMERCE" | "AUTRE";
  fileUrl: string;
  note: string | null;
  uploadedAt: string;
}

const TYPES_DOCUMENT_IDENTITE = ["PIECE_IDENTITE_DIRIGEANT", "REGISTRE_COMMERCE", "AUTRE"] as const;

/**
 * Documents d'identité (18 nov. 2026, chantier "gestion de risque autonome"
 * Phase 4, volet KYC retenu par le propriétaire : identification + piste
 * d'audit interne, sans détection automatisée AML) — même pattern d'upload
 * en deux temps que FacturationElegansSection.deposerPreuve ci-dessus
 * (upload-url signée, PUT direct sur le stockage, puis confirmation).
 * Purement déclaratif et consultable par une institution partenaire ayant
 * accès à la boutique, pour SA PROPRE vérification réglementaire — ELEGANZ
 * ne vérifie, n'authentifie ni ne valide jamais ces documents elle-même.
 */
function DocumentsIdentiteSection({ shopId }: { shopId: string }) {
  const { t } = useLocale();
  const [documents, setDocuments] = useState<DocumentIdentite[] | null>(null);
  const [type, setType] = useState<string>("PIECE_IDENTITE_DIRIGEANT");
  const [note, setNote] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  function recharger() {
    api
      .get<DocumentIdentite[]>(`/shops/${shopId}/identity-documents`)
      .then(setDocuments)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("kyc_erreurChargement")));
  }

  useEffect(recharger, [shopId]);

  async function televerser(fichier: File) {
    setEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/shops/${shopId}/identity-documents/upload-url`,
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": fichier.type }, body: fichier });
      if (!envoi.ok) throw new Error(t("kyc_erreurEnvoiStockage"));
      await api.post(`/shops/${shopId}/identity-documents`, { type, fileUrl: publicUrl, note: note || undefined });
      setConfirmation(t("kyc_documentDepose"));
      setNote("");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("kyc_erreurEnvoiDocument"));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sousTitre}>{t("kyc_titre")}</h2>
      <p className={styles.note}>{t("kyc_description")}</p>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label htmlFor="kycType">{t("kyc_typeLabel")}</label>
          <select id="kycType" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES_DOCUMENT_IDENTITE.map((v) => (
              <option key={v} value={v}>
                {t(`kyc_docType_${v}`)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="kycNote">{t("kyc_noteLabel")}</label>
          <input id="kycNote" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          disabled={enCours}
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            if (fichier) televerser(fichier);
            e.target.value = "";
          }}
        />
      </div>

      {documents === null ? (
        <p className={styles.note}>{t("kyc_chargement")}</p>
      ) : documents.length === 0 ? (
        <p className={styles.note}>{t("kyc_aucunDocument")}</p>
      ) : (
        <ul>
          {documents.map((d) => (
            <li key={d.id}>
              <a href={d.fileUrl} target="_blank" rel="noreferrer">
                {t(`kyc_docType_${d.type}`)}
              </a>
              {" — "}
              {new Date(d.uploadedAt).toLocaleDateString("fr-FR")}
              {d.note ? ` — ${d.note}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ParametresContent() {
  const { currentShop, reload } = useShop();
  const { t } = useLocale();
  const router = useRouter();
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  // Mon compte personnel (demande du 16 oct. 2026, point 2) — identité du
  // propriétaire/membre connecté, distincte de l'identité de facturation de
  // la boutique ci-dessous.
  const [compte, setCompte] = useState<Compte | null>(null);
  const [editionCompte, setEditionCompte] = useState(false);
  const [nomEdite, setNomEdite] = useState("");
  const [emailEdite, setEmailEdite] = useState("");
  const [telephoneEdite, setTelephoneEdite] = useState("");
  const [enregistrementCompte, setEnregistrementCompte] = useState(false);
  const [erreurCompte, setErreurCompte] = useState<string | null>(null);

  // Changement de mot de passe (demande du 10 nov. 2026, point 3) — formulaire
  // séparé de l'identité ci-dessus : exige l'ancien mot de passe (revérifié
  // côté API) avant d'accepter le nouveau, voir AuthService.changePassword.
  const [editionMotDePasse, setEditionMotDePasse] = useState(false);
  const [motDePasseActuel, setMotDePasseActuel] = useState("");
  const [motDePasseNouveau, setMotDePasseNouveau] = useState("");
  const [motDePasseConfirmation, setMotDePasseConfirmation] = useState("");
  const [enregistrementMotDePasse, setEnregistrementMotDePasse] = useState(false);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | null>(null);
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState<string | null>(null);

  function ouvrirEditionMotDePasse() {
    setMotDePasseActuel("");
    setMotDePasseNouveau("");
    setMotDePasseConfirmation("");
    setErreurMotDePasse(null);
    setConfirmationMotDePasse(null);
    setEditionMotDePasse(true);
  }

  async function enregistrerMotDePasse(e: React.FormEvent) {
    e.preventDefault();
    setErreurMotDePasse(null);
    if (motDePasseNouveau.length < 8) {
      setErreurMotDePasse(t("profil_motDePasseTropCourt"));
      return;
    }
    if (motDePasseNouveau !== motDePasseConfirmation) {
      setErreurMotDePasse(t("profil_motDePasseConfirmationIncorrecte"));
      return;
    }
    setEnregistrementMotDePasse(true);
    try {
      await api.patch("/auth/me/password", {
        currentPassword: motDePasseActuel,
        newPassword: motDePasseNouveau,
      });
      setConfirmationMotDePasse(t("profil_motDePasseConfirmationChangement"));
      setEditionMotDePasse(false);
      setMotDePasseActuel("");
      setMotDePasseNouveau("");
      setMotDePasseConfirmation("");
    } catch (err) {
      setErreurMotDePasse(
        err instanceof ApiError && err.statusCode === 401
          ? t("profil_motDePasseErreurActuel")
          : err instanceof ApiError
            ? err.message
            : t("profil_motDePasseErreurGenerique"),
      );
    } finally {
      setEnregistrementMotDePasse(false);
    }
  }

  useEffect(() => {
    api.get<Compte>("/auth/me").then(setCompte).catch(() => {
      // Non bloquant : sans ces infos, les autres sections restent utilisables.
    });
  }, []);

  function ouvrirEditionCompte() {
    setNomEdite(compte?.fullName ?? "");
    setEmailEdite(compte?.email ?? "");
    setTelephoneEdite(compte?.phone ?? "");
    setErreurCompte(null);
    setEditionCompte(true);
  }

  async function enregistrerCompte(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrementCompte(true);
    setErreurCompte(null);
    try {
      const miseAJour = await api.patch<Compte>("/auth/me", {
        fullName: nomEdite.trim() || undefined,
        email: emailEdite.trim() || undefined,
        phone: telephoneEdite.trim() || undefined,
      });
      setCompte(miseAJour);
      setEditionCompte(false);
    } catch (err) {
      setErreurCompte(err instanceof ApiError ? err.message : t("profil_erreurEnregistrement"));
    } finally {
      setEnregistrementCompte(false);
    }
  }

  // Abonnement Gestion en libre-service (16 oct. 2026, demande du
  // propriétaire ELEGANZ, point 1 des propositions du 16 oct. 2026) —
  // volontairement limité au bouquet GESTION ; voir
  // ShopSubscriptionController/BillingService.changerBouquetGestion côté API.
  const [abonnement, setAbonnement] = useState<StatutAbonnementGestion | null>(null);
  const [chargementAbonnement, setChargementAbonnement] = useState(true);
  const [erreurAbonnement, setErreurAbonnement] = useState<string | null>(null);
  const [bouquetEnChangement, setBouquetEnChangement] = useState<string | null>(null);
  const [resultatChangement, setResultatChangement] = useState<ResultatChangementBouquet | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargementAbonnement(true);
    setErreurAbonnement(null);
    api
      .get<StatutAbonnementGestion>(`/shops/${currentShop.id}/subscription/gestion`)
      .then(setAbonnement)
      .catch((err) =>
        setErreurAbonnement(err instanceof ApiError ? err.message : t("abonnement_erreurChargement")),
      )
      .finally(() => setChargementAbonnement(false));
  }, [currentShop]);

  async function changerBouquet(plan: BouquetGestion) {
    if (!currentShop) return;
    const confirmation = window.confirm(
      `${t("abonnement_confirmationPrefix")} ${plan.name} ${t("abonnement_confirmationSuffix")}`,
    );
    if (!confirmation) return;
    setBouquetEnChangement(plan.id);
    setErreurAbonnement(null);
    setResultatChangement(null);
    try {
      const resultat = await api.post<ResultatChangementBouquet>(
        `/shops/${currentShop.id}/subscription/gestion/change`,
        { planId: plan.id },
      );
      setResultatChangement(resultat);
      const statut = await api.get<StatutAbonnementGestion>(`/shops/${currentShop.id}/subscription/gestion`);
      setAbonnement(statut);
    } catch (err) {
      setErreurAbonnement(err instanceof ApiError ? err.message : t("abonnement_erreurChangement"));
    } finally {
      setBouquetEnChangement(null);
    }
  }

  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  // Upload direct du logo (13 nov. 2026, signalement : "pour les url de
  // logo des boutique prière donner la possibilité en plus du lien de
  // charger une image") — même principe que le téléversement des photos
  // d'article en Catalogue : URL signée R2, le fichier ne transite jamais
  // par notre serveur. Remplit simplement `logoUrl`, exactement comme si la
  // boutique avait collé le lien à la main — le champ URL reste disponible
  // en parallèle pour qui héberge déjà son logo ailleurs.
  const [televersementLogoEnCours, setTeleversementLogoEnCours] = useState(false);
  const inputLogoRef = useRef<HTMLInputElement>(null);
  // En-tête personnalisé (20 nov. 2026, étalage du champ déjà livré pour le
  // portail Institution) — même soumission que noteBasPage ci-dessous.
  const [enTete, setEnTete] = useState("");
  const [noteBasPage, setNoteBasPage] = useState("");
  // Choix du type de facture par défaut à la caisse (demande du 11 nov. 2026)
  // — "" = aucune préférence (comportement historique de la caisse,
  // sélection sur Ticket). INVOICE_FISCAL n'est proposable que si
  // l'homologation DGI de cette boutique a été confirmée par
  // l'administration ELEGANZ (voir fiscalHomologationConfirmed) ; ce n'est
  // jamais la boutique elle-même qui s'auto-déclare homologuée.
  const [typeFactureDefaut, setTypeFactureDefaut] = useState("");
  const [homologationConfirmee, setHomologationConfirmee] = useState(false);
  // Facture normalisée auto-déclarée (14 nov. 2026) — case à cocher dans ce
  // même formulaire "documents imprimés", mais champ totalement distinct de
  // fiscalHomologationConfirmed/homologationConfirmee ci-dessus : voir le
  // commentaire de Shop.normalisationAutoDeclaree dans schema.prisma.
  const [normalisationAutoDeclaree, setNormalisationAutoDeclaree] = useState(false);
  const [slug, setSlug] = useState("");
  const [publiee, setPubliee] = useState(false);
  const [lienCopie, setLienCopie] = useState(false);

  // Identité fiscale et juridique (14 nov. 2026) — formulaire et soumission
  // indépendants, voir l'interface IdentiteFiscale ci-dessus.
  const [identiteFiscale, setIdentiteFiscale] = useState<IdentiteFiscale | null>(null);
  const [chargementIdentiteFiscale, setChargementIdentiteFiscale] = useState(true);
  const [erreurIdentiteFiscale, setErreurIdentiteFiscale] = useState<string | null>(null);
  const [confirmationIdentiteFiscale, setConfirmationIdentiteFiscale] = useState<string | null>(null);

  // Description publique de la boutique (14 nov. 2026, demande : "zone
  // description briève de la boutique sur la page propre de la boutique...
  // le contenu doit être modifiable dans le paramètre de la boutique")  —
  // formulaire et appel API indépendants de `enregistrer` ci-dessus (qui ne
  // couvre que l'identité sur les documents imprimés), pour ne pas mélanger
  // les deux dans un même état de soumission.
  const [description, setDescription] = useState("");
  const [enregistrementDescription, setEnregistrementDescription] = useState(false);
  const [confirmationDescription, setConfirmationDescription] = useState<string | null>(null);
  const [erreurDescription, setErreurDescription] = useState<string | null>(null);

  // Secteur d'activité (18 nov. 2026, chantier "gestion de risque autonome"
  // Phase 2) — formulaire indépendant, même principe que la description
  // ci-dessus : purement informatif pour les institutions financières
  // partenaires, jamais utilisé par ELEGANZ elle-même.
  const [secteurActivite, setSecteurActivite] = useState("");
  const [enregistrementSecteur, setEnregistrementSecteur] = useState(false);
  const [confirmationSecteur, setConfirmationSecteur] = useState<string | null>(null);
  const [erreurSecteur, setErreurSecteur] = useState<string | null>(null);

  // Fermeture de boutique en libre-service (18 oct. 2026) — confirmation
  // par saisie exacte du nom de la boutique, même geste que les autres
  // actions irréversibles de la plateforme, pour éviter un clic accidentel
  // sur une action qu'on ne peut pas annuler.
  const [confirmationNomFermeture, setConfirmationNomFermeture] = useState("");
  const [fermetureEnCours, setFermetureEnCours] = useState(false);
  const [erreurFermeture, setErreurFermeture] = useState<string | null>(null);

  async function fermerBoutique() {
    if (!currentShop) return;
    setFermetureEnCours(true);
    setErreurFermeture(null);
    try {
      await api.post(`/shops/${currentShop.id}/close`);
      reload();
      router.push("/");
    } catch (err) {
      setErreurFermeture(err instanceof ApiError ? err.message : t("param_fermetureImpossible"));
    } finally {
      setFermetureEnCours(false);
    }
  }

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    api
      .get<ShopDetails>(`/shops/${currentShop.id}`)
      .then((shop) => {
        setAdresse(shop.invoiceAddress ?? "");
        setTelephone(shop.invoicePhone ?? "");
        setLogoUrl(shop.invoiceLogoUrl ?? "");
        setEnTete(shop.invoiceHeaderNote ?? "");
        setNoteBasPage(shop.invoiceFooterNote ?? "");
        setTypeFactureDefaut(shop.defaultInvoiceType ?? "");
        setHomologationConfirmee(Boolean(shop.fiscalHomologationConfirmed));
        setNormalisationAutoDeclaree(Boolean(shop.normalisationAutoDeclaree));
        setSlug(shop.slug);
        setPubliee(shop.isPubliclyListed);
        setDescription(shop.description ?? "");
        setSecteurActivite(shop.secteurActivite ?? "");
      })
      .catch((err) =>
        setErreur(
          err instanceof Error ? err.message : t("param_erreurChargement"),
        ),
      )
      .finally(() => setChargement(false));
  }, [currentShop]);

  useEffect(() => {
    if (!currentShop) return;
    setChargementIdentiteFiscale(true);
    api
      .get<IdentiteFiscale>(`/shops/${currentShop.id}/finance/fiscal-identity`)
      .then(setIdentiteFiscale)
      .catch((err) =>
        setErreurIdentiteFiscale(err instanceof ApiError ? err.message : t("param_erreurChargement")),
      )
      .finally(() => setChargementIdentiteFiscale(false));
  }, [currentShop]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop) return;
    setEnregistrement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch(`/shops/${currentShop.id}/invoice-settings`, {
        invoiceAddress: adresse,
        invoicePhone: telephone,
        invoiceLogoUrl: logoUrl,
        invoiceHeaderNote: enTete,
        invoiceFooterNote: noteBasPage,
        defaultInvoiceType: typeFactureDefaut || null,
        normalisationAutoDeclaree,
      });
      setConfirmation(t("param_confirmationEnregistrement"));
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.message
          : t("param_erreurEnregistrement"),
      );
    } finally {
      setEnregistrement(false);
    }
  }

  async function enregistrerIdentiteFiscale(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!currentShop) return;
    const form = new FormData(e.currentTarget);
    setErreurIdentiteFiscale(null);
    setConfirmationIdentiteFiscale(null);
    try {
      const miseAJour = {
        fiscalLegalName: (form.get("fiscalLegalName") as string) || undefined,
        fiscalLegalForm: (form.get("fiscalLegalForm") as string) || undefined,
        fiscalIdNumber: (form.get("fiscalIdNumber") as string) || undefined,
        fiscalAddress: (form.get("fiscalAddress") as string) || undefined,
        fiscalJurisdiction: (form.get("fiscalJurisdiction") as string) || undefined,
        fiscalRegime: (form.get("fiscalRegime") as string) || undefined,
        fiscalExercice: (form.get("fiscalExercice") as string) || undefined,
        fiscalVatRegistered: form.get("fiscalVatRegistered") === "on",
      };
      await api.patch(`/shops/${currentShop.id}/finance/fiscal-identity`, miseAJour);
      setIdentiteFiscale((prev) => ({
        fiscalLegalName: miseAJour.fiscalLegalName ?? prev?.fiscalLegalName ?? null,
        fiscalLegalForm: miseAJour.fiscalLegalForm ?? prev?.fiscalLegalForm ?? null,
        fiscalIdNumber: miseAJour.fiscalIdNumber ?? prev?.fiscalIdNumber ?? null,
        fiscalAddress: miseAJour.fiscalAddress ?? prev?.fiscalAddress ?? null,
        fiscalJurisdiction: miseAJour.fiscalJurisdiction ?? prev?.fiscalJurisdiction ?? null,
        fiscalRegime: miseAJour.fiscalRegime ?? prev?.fiscalRegime ?? null,
        fiscalExercice: miseAJour.fiscalExercice ?? prev?.fiscalExercice ?? null,
        fiscalVatRegistered: miseAJour.fiscalVatRegistered,
      }));
      setConfirmationIdentiteFiscale(t("rfi_infosEnregistrees"));
    } catch (err) {
      setErreurIdentiteFiscale(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    }
  }

  async function enregistrerDescription(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop) return;
    setEnregistrementDescription(true);
    setErreurDescription(null);
    setConfirmationDescription(null);
    try {
      await api.patch(`/shops/${currentShop.id}/description`, { description });
      setConfirmationDescription(t("param_descriptionBoutiqueConfirmation"));
    } catch (err) {
      setErreurDescription(err instanceof ApiError ? err.message : t("param_descriptionBoutiqueErreur"));
    } finally {
      setEnregistrementDescription(false);
    }
  }

  async function enregistrerSecteur(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop) return;
    setEnregistrementSecteur(true);
    setErreurSecteur(null);
    setConfirmationSecteur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/secteur-activite`, { secteurActivite: secteurActivite || null });
      setConfirmationSecteur(t("param_secteurActiviteConfirmation"));
    } catch (err) {
      setErreurSecteur(err instanceof ApiError ? err.message : t("param_secteurActiviteErreur"));
    } finally {
      setEnregistrementSecteur(false);
    }
  }

  async function televerserLogo(fichier: File) {
    if (!currentShop) return;
    setTeleversementLogoEnCours(true);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        `/shops/${currentShop.id}/invoice-settings/logo-upload-url`,
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!envoi.ok) {
        throw new Error(t("param_erreurEnvoiLogoReseau"));
      }
      setLogoUrl(publicUrl);
    } catch (err) {
      // Même distinction qu'en Catalogue (ImagesProduit.televerserPhoto) :
      // `fetch` vers le stockage objet échoue en `TypeError` dès que la
      // requête n'atteint jamais le serveur (CORS, réseau, URL expirée).
      if (err instanceof TypeError) {
        setErreur(t("param_erreurEnvoiLogoReseau"));
      } else {
        setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("param_erreurEnvoiLogo"));
      }
    } finally {
      setTeleversementLogoEnCours(false);
    }
  }

  if (chargement) return <p>{t("param_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_parametres")}</h1>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("profil_informationsCompte")}</h2>
        {editionCompte ? (
          <form className={styles.formulaire} onSubmit={enregistrerCompte}>
            <div className={styles.champ}>
              <label>{t("activites_nom")}</label>
              <input value={nomEdite} onChange={(e) => setNomEdite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_email")}</label>
              <input type="email" value={emailEdite} onChange={(e) => setEmailEdite(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_telephone")}</label>
              <input value={telephoneEdite} onChange={(e) => setTelephoneEdite(e.target.value)} placeholder={t("profil_placeholderTelephone")} />
            </div>
            {erreurCompte && <div className={styles.erreur}>{erreurCompte}</div>}
            <div style={{ display: "flex", gap: "var(--espace-3)" }}>
              <button className={styles.bouton} type="submit" disabled={enregistrementCompte}>
                {enregistrementCompte ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
              </button>
              <button className={styles.bouton} type="button" onClick={() => setEditionCompte(false)} style={{ background: "var(--color-texte-muted)" }}>
                {t("action_annuler")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className={styles.champ}>
              <span>{t("activites_nom")} : {compte?.fullName ?? "…"}</span>
            </div>
            <div className={styles.champ}>
              <span>{t("profil_email")} : {compte?.email ?? t("profil_nonRenseigne")}</span>
            </div>
            <div className={styles.champ}>
              <span>{t("profil_telephone")} : {compte?.phone ?? t("profil_nonRenseigne")}</span>
            </div>
            <button className={styles.bouton} onClick={ouvrirEditionCompte}>
              {t("profil_modifier")}
            </button>
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("profil_motDePasseTitre")}</h2>
        {confirmationMotDePasse && !editionMotDePasse && (
          <div className={styles.confirmation}>{confirmationMotDePasse}</div>
        )}
        {editionMotDePasse ? (
          <form className={styles.formulaire} onSubmit={enregistrerMotDePasse}>
            <div className={styles.champ}>
              <label>{t("profil_motDePasseActuel")}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={motDePasseActuel}
                onChange={(e) => setMotDePasseActuel(e.target.value)}
              />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_motDePasseNouveau")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={motDePasseNouveau}
                onChange={(e) => setMotDePasseNouveau(e.target.value)}
              />
            </div>
            <div className={styles.champ}>
              <label>{t("profil_motDePasseConfirmation")}</label>
              <input
                type="password"
                autoComplete="new-password"
                value={motDePasseConfirmation}
                onChange={(e) => setMotDePasseConfirmation(e.target.value)}
              />
            </div>
            {erreurMotDePasse && <div className={styles.erreur}>{erreurMotDePasse}</div>}
            <div style={{ display: "flex", gap: "var(--espace-3)" }}>
              <button className={styles.bouton} type="submit" disabled={enregistrementMotDePasse}>
                {enregistrementMotDePasse ? t("profil_motDePasseEnCours") : t("action_enregistrer")}
              </button>
              <button
                className={styles.bouton}
                type="button"
                onClick={() => setEditionMotDePasse(false)}
                style={{ background: "var(--color-texte-muted)" }}
              >
                {t("action_annuler")}
              </button>
            </div>
          </form>
        ) : (
          <button className={styles.bouton} onClick={ouvrirEditionMotDePasse}>
            {t("profil_motDePasseModifier")}
          </button>
        )}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("param_identiteTitre")}</h2>
        <p className={styles.note}>{t("param_identiteNote")}</p>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

        <form className={styles.formulaire} onSubmit={enregistrer}>
          <div className={styles.champ}>
            <label htmlFor="adresse">{t("param_labelAdresse")}</label>
            <input
              id="adresse"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder={t("param_placeholderAdresse")}
              maxLength={200}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="telephone">{t("param_labelTelephone")}</label>
            <input
              id="telephone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder={t("param_placeholderTelephone")}
              maxLength={50}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="logoUrl">{t("param_labelLogo")}</label>
            <input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              maxLength={500}
            />
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--espace-3)", marginTop: "var(--espace-1)" }}>
              <button
                type="button"
                className={styles.boutonSecondaire}
                disabled={televersementLogoEnCours}
                onClick={() => inputLogoRef.current?.click()}
              >
                {televersementLogoEnCours ? t("param_televersementLogoEnCours") : t("param_televerserLogo")}
              </button>
              <input
                ref={inputLogoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                disabled={televersementLogoEnCours}
                onChange={(e) => {
                  const fichier = e.target.files?.[0];
                  e.target.value = "";
                  if (fichier) televerserLogo(fichier);
                }}
              />
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className={styles.logoApercu} />
              )}
            </div>
          </div>
          <div className={styles.champ}>
            <label htmlFor="enTete">{t("param_labelEnTete")}</label>
            <input
              id="enTete"
              value={enTete}
              onChange={(e) => setEnTete(e.target.value)}
              placeholder={t("param_placeholderEnTete")}
              maxLength={300}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="noteBasPage">{t("param_labelNoteBasPage")}</label>
            <textarea
              id="noteBasPage"
              value={noteBasPage}
              onChange={(e) => setNoteBasPage(e.target.value)}
              rows={2}
              placeholder={t("param_placeholderNoteBasPage")}
              maxLength={300}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="typeFactureDefaut">{t("param_labelTypeFactureDefaut")}</label>
            <select
              id="typeFactureDefaut"
              value={typeFactureDefaut}
              onChange={(e) => setTypeFactureDefaut(e.target.value)}
            >
              <option value="">{t("param_typeFactureDefautAucune")}</option>
              <option value="INVOICE_INTERNAL">{t("fact_typeFactureInterne")}</option>
              <option value="INVOICE_FISCAL" disabled={!homologationConfirmee}>
                {t("caisse_typeFactureFiscaleHomologuee")}
                {!homologationConfirmee ? ` — ${t("param_typeFactureDefautNonHomologuee")}` : ""}
              </option>
            </select>
            <p className={styles.note}>
              {homologationConfirmee
                ? t("param_typeFactureDefautNote")
                : t("param_typeFactureDefautNoteNonHomologuee")}
            </p>
          </div>
          <div className={styles.champ} style={{ flexDirection: "row", alignItems: "flex-start", gap: "8px" }}>
            <input
              id="normalisationAutoDeclaree"
              type="checkbox"
              checked={normalisationAutoDeclaree}
              onChange={(e) => setNormalisationAutoDeclaree(e.target.checked)}
              style={{ marginTop: "3px" }}
            />
            <label htmlFor="normalisationAutoDeclaree">
              {t("param_normalisationAutoDeclareeLabel")}
              <p className={styles.note} style={{ marginTop: "4px" }}>
                {t("param_normalisationAutoDeclareeNote")}
              </p>
            </label>
          </div>
          <button className={styles.bouton} type="submit" disabled={enregistrement}>
            {enregistrement ? t("param_enregistrementEnCours") : t("param_enregistrer")}
          </button>
        </form>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("rfi_infosEntreprise")}</h2>
        <p className={styles.note}>{t("param_identiteFiscaleNote")}</p>

        {erreurIdentiteFiscale && <div className={styles.erreur}>{erreurIdentiteFiscale}</div>}
        {confirmationIdentiteFiscale && <div className={styles.confirmation}>{confirmationIdentiteFiscale}</div>}

        {chargementIdentiteFiscale ? (
          <p className={styles.note}>{t("commun_chargement")}</p>
        ) : (
          <form className={styles.formulaire} onSubmit={enregistrerIdentiteFiscale}>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalName">{t("rfi_denomination")}</label>
              <input id="fiscalLegalName" name="fiscalLegalName" defaultValue={identiteFiscale?.fiscalLegalName ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalLegalForm">{t("rfi_formeJuridique")}</label>
              <input id="fiscalLegalForm" name="fiscalLegalForm" defaultValue={identiteFiscale?.fiscalLegalForm ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalIdNumber">{t("rfi_numeroIdFiscal")}</label>
              <input id="fiscalIdNumber" name="fiscalIdNumber" defaultValue={identiteFiscale?.fiscalIdNumber ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalAddress">{t("rfi_adresseFiscale")}</label>
              <input id="fiscalAddress" name="fiscalAddress" defaultValue={identiteFiscale?.fiscalAddress ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalJurisdiction">{t("rfi_juridictionFiscale")}</label>
              <input id="fiscalJurisdiction" name="fiscalJurisdiction" defaultValue={identiteFiscale?.fiscalJurisdiction ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalRegime">{t("rfi_regimeDeclare")}</label>
              <input id="fiscalRegime" name="fiscalRegime" defaultValue={identiteFiscale?.fiscalRegime ?? ""} />
            </div>
            <div className={styles.champ}>
              <label htmlFor="fiscalExercice">{t("rfi_exerciceComptable")}</label>
              <input id="fiscalExercice" name="fiscalExercice" placeholder="01/01-31/12" defaultValue={identiteFiscale?.fiscalExercice ?? ""} />
            </div>
            <div className={styles.champ} style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input
                id="fiscalVatRegistered"
                name="fiscalVatRegistered"
                type="checkbox"
                defaultChecked={identiteFiscale?.fiscalVatRegistered ?? false}
              />
              <label htmlFor="fiscalVatRegistered">{t("rfi_assujettieTva")}</label>
            </div>
            <button className={styles.bouton} type="submit">
              {t("rfi_enregistrerInfos")}
            </button>
          </form>
        )}
      </section>

      {currentShop && (
        <section className={styles.section}>
          <h2 className={styles.sousTitre}>{t("nav_abonnement")}</h2>

          {chargementAbonnement ? (
            <p className={styles.note}>{t("abonnement_chargement")}</p>
          ) : (
            <>
              {erreurAbonnement && <div className={styles.erreur}>{erreurAbonnement}</div>}

              {resultatChangement && (
                <div className={styles.confirmation}>
                  <strong>{t("abonnement_resultatTitre")}</strong> — {resultatChangement.nouveauPlan.name}
                  <br />
                  {resultatChangement.complement > 0 && (
                    <span>{t("abonnement_resultatComplementDu")} : {formatMoney(resultatChangement.complement)}</span>
                  )}
                  {resultatChangement.complement < 0 && (
                    <span>{t("abonnement_resultatCredit")} : {formatMoney(Math.abs(resultatChangement.complement))}</span>
                  )}
                  {resultatChangement.complement === 0 && <span>{t("abonnement_resultatAucunComplement")}</span>}
                  <br />
                  <button
                    className={styles.bouton}
                    type="button"
                    onClick={() => setResultatChangement(null)}
                    style={{ marginTop: "var(--espace-3)" }}
                  >
                    {t("abonnement_fermer")}
                  </button>
                </div>
              )}

              {abonnement?.planActuel && (
                <div className={styles.champ}>
                  <span>
                    {t("abonnement_planActuel")} : <strong>{abonnement.planActuel.name}</strong> —{" "}
                    {formatMoney(Number(abonnement.planActuel.monthlyPrice))}
                    {t("abonnement_parMois")}
                  </span>
                </div>
              )}
              <div className={styles.champ}>
                <span>
                  {t("abonnement_renouvellement")} :{" "}
                  {abonnement?.cycle ? formatDate(abonnement.cycle.renouvellement) : t("abonnement_aucunCycle")}
                </span>
              </div>

              <h3 className={styles.sousTitre} style={{ marginTop: "var(--espace-4)" }}>
                {t("abonnement_catalogueTitre")}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--espace-3)" }}>
                {abonnement?.catalogue.map((plan) => {
                  const estActuel = plan.id === abonnement.planActuel?.id;
                  return (
                    <div
                      key={plan.id}
                      className={styles.champ}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        border: "1px solid var(--color-border)",
                        borderRadius: "8px",
                        padding: "var(--espace-3)",
                      }}
                    >
                      <span>
                        <strong>{plan.name}</strong> — {formatMoney(Number(plan.monthlyPrice))}
                        {t("abonnement_parMois")}
                        {plan.maxActiveProducts != null && (
                          <> · {t("abonnement_produitsMax")} : {plan.maxActiveProducts}</>
                        )}
                        {plan.commissionRate != null && (
                          <> · {t("abonnement_tauxCommission")} : {Number(plan.commissionRate)}%</>
                        )}
                      </span>
                      {estActuel ? (
                        <span className={styles.note}>{t("abonnement_bouquetActuelBadge")}</span>
                      ) : (
                        <button
                          className={styles.bouton}
                          type="button"
                          disabled={bouquetEnChangement !== null}
                          onClick={() => changerBouquet(plan)}
                        >
                          {bouquetEnChangement === plan.id
                            ? t("abonnement_changementEnCours")
                            : t("abonnement_choisirBouquet")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <FacturationElegansSection shopId={currentShop.id} shopStatus={currentShop.status} />
            </>
          )}
        </section>
      )}

      {currentShop && (
        <section className={styles.section}>
          <h2 className={styles.sousTitre}>{t("param_lienBoutiqueTitre")}</h2>

          <form className={styles.formulaire} onSubmit={enregistrerDescription}>
            <div className={styles.champ}>
              <label htmlFor="descriptionBoutique">{t("param_descriptionBoutiqueLabel")}</label>
              <textarea
                id="descriptionBoutique"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t("param_descriptionBoutiquePlaceholder")}
                maxLength={600}
              />
              <p className={styles.note}>{t("param_descriptionBoutiqueNote")}</p>
            </div>
            {erreurDescription && <div className={styles.erreur}>{erreurDescription}</div>}
            {confirmationDescription && <div className={styles.confirmation}>{confirmationDescription}</div>}
            <button className={styles.bouton} type="submit" disabled={enregistrementDescription}>
              {enregistrementDescription ? t("param_enregistrementEnCours") : t("action_enregistrer")}
            </button>
          </form>

          <form className={styles.formulaire} onSubmit={enregistrerSecteur}>
            <div className={styles.champ}>
              <label htmlFor="secteurActivite">{t("secteurActiviteLabel")}</label>
              <select
                id="secteurActivite"
                value={secteurActivite}
                onChange={(e) => setSecteurActivite(e.target.value)}
              >
                <option value="">{t("secteurActivitePlaceholder")}</option>
                {SECTEURS_ACTIVITE.map((s) => (
                  <option key={s} value={s}>
                    {t(`secteur_${s}`)}
                  </option>
                ))}
              </select>
              <p className={styles.note}>{t("param_secteurActiviteNote")}</p>
            </div>
            {erreurSecteur && <div className={styles.erreur}>{erreurSecteur}</div>}
            {confirmationSecteur && <div className={styles.confirmation}>{confirmationSecteur}</div>}
            <button className={styles.bouton} type="submit" disabled={enregistrementSecteur}>
              {enregistrementSecteur ? t("param_enregistrementEnCours") : t("action_enregistrer")}
            </button>
          </form>

          {publiee ? (
            <>
              <p className={styles.note}>{t("param_lienBoutiqueDescription")}</p>
              <div className={styles.champ}>
                <input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/marketplace/boutique/${slug}` : ""}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <button
                className={styles.bouton}
                type="button"
                onClick={async () => {
                  const lien = `${window.location.origin}/marketplace/boutique/${slug}`;
                  try {
                    await navigator.clipboard.writeText(lien);
                    setLienCopie(true);
                    setTimeout(() => setLienCopie(false), 2000);
                  } catch {
                    // Presse-papiers indisponible (permission refusée, contexte non sécurisé) —
                    // le champ ci-dessus reste copiable manuellement.
                  }
                }}
              >
                {lienCopie ? t("param_lienCopie") : t("param_copierLien")}
              </button>
            </>
          ) : (
            <p className={styles.note}>{t("param_boutiqueNonPubliee")}</p>
          )}
        </section>
      )}

      {currentShop && <DocumentsIdentiteSection shopId={currentShop.id} />}

      {currentShop && (
        <section className={styles.section}>
          <h2 className={styles.sousTitre}>{t("zonesLivraison_titre")}</h2>
          <p className={styles.note}>{t("zonesLivraison_description")}</p>
          <ZonesLivraison shopId={currentShop.id} />
        </section>
      )}

      {currentShop && currentShop.myRole === "OWNER" && (
        <section className={`${styles.section} ${styles.zoneDanger}`}>
          <h2 className={styles.sousTitre}>{t("param_zoneDangerTitre")}</h2>
          <p className={styles.note}>{t("param_zoneDangerDescription")}</p>
          {erreurFermeture && <p className={styles.erreur}>{erreurFermeture}</p>}
          <div className={styles.champ}>
            <label>{t("param_zoneDangerConfirmationLabel").replace("{{nom}}", currentShop.name)}</label>
            <input
              value={confirmationNomFermeture}
              onChange={(e) => setConfirmationNomFermeture(e.target.value)}
              placeholder={currentShop.name}
            />
          </div>
          <button
            className={styles.boutonDanger}
            type="button"
            disabled={fermetureEnCours || confirmationNomFermeture.trim() !== currentShop.name}
            onClick={fermerBoutique}
          >
            {fermetureEnCours ? t("param_zoneDangerFermetureEnCours") : t("param_zoneDangerFermerBoutique")}
          </button>
        </section>
      )}
    </div>
  );
}

export default function ParametresPage() {
  return (
    <ProtectedGestionPage>
      <ParametresContent />
    </ProtectedGestionPage>
  );
}
