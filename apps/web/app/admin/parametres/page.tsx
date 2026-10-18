"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface PlatformSettings {
  address?: string | null;
  website?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  whatsappLink?: string | null;
  telegramLink?: string | null;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  photoSearchEnabled?: boolean;
  adStudioEnabled?: boolean;
  notificationsInAppEnabled?: boolean;
  notificationsEmailEnabled?: boolean;
  notificationsSmsEnabled?: boolean;
  chatWidgetEnabled?: boolean;
  // Identité fiscale d'ELEGANZ en tant que société (16 oct. 2026, commit
  // c819cb8) — champs déjà en base et déjà consommés par le dossier crédit
  // plateforme et le rapport annuel (admin-finance.service.ts,
  // rapport-annuel.service.ts), mais sans AUCUN formulaire pour les
  // renseigner jusqu'ici (audit du 18 oct. 2026, point 3). Le PATCH
  // /admin/platform-settings les acceptait déjà — seul l'écran manquait.
  platformFiscalLegalName?: string | null;
  platformFiscalIdNumber?: string | null;
  platformFiscalAddress?: string | null;
  platformFiscalRegime?: string | null;
  platformFoundedAt?: string | null;
}

const CLES_FONCTIONNALITES_IA: { cle: "photoSearchEnabled" | "adStudioEnabled"; labelCle: string; descriptionCle: string }[] = [
  {
    cle: "photoSearchEnabled",
    labelCle: "admparam_iaPhotoLabel",
    descriptionCle: "admparam_iaPhotoDescription",
  },
  {
    cle: "adStudioEnabled",
    labelCle: "admparam_iaStudioLabel",
    descriptionCle: "admparam_iaStudioDescription",
  },
];

type ChampTexte = Exclude<
  keyof PlatformSettings,
  | "photoSearchEnabled"
  | "adStudioEnabled"
  | "notificationsInAppEnabled"
  | "notificationsEmailEnabled"
  | "notificationsSmsEnabled"
  | "chatWidgetEnabled"
>;

const CLES_CANAUX_NOTIFICATION: {
  cle: "notificationsInAppEnabled" | "notificationsEmailEnabled" | "notificationsSmsEnabled";
  labelCle: string;
  descriptionCle: string;
}[] = [
  {
    cle: "notificationsInAppEnabled",
    labelCle: "admparam_canalInAppLabel",
    descriptionCle: "admparam_canalInAppDescription",
  },
  {
    cle: "notificationsEmailEnabled",
    labelCle: "admparam_canalEmailLabel",
    descriptionCle: "admparam_canalEmailDescription",
  },
  {
    cle: "notificationsSmsEnabled",
    labelCle: "admparam_canalSmsLabel",
    descriptionCle: "admparam_canalSmsDescription",
  },
];

// Champs texte de l'identité fiscale ELEGANZ (18 oct. 2026, audit du 18
// oct. 2026, point 3) — formulaire séparé du bloc "Coordonnées & réseaux
// sociaux" ci-dessous, avec son propre bouton d'enregistrement, pour ne
// jamais mélanger les deux PATCH dans la même soumission.
const CLES_CHAMPS_FISCAL: { cle: "platformFiscalLegalName" | "platformFiscalIdNumber" | "platformFiscalAddress" | "platformFiscalRegime"; labelCle: string; placeholder: string }[] = [
  { cle: "platformFiscalLegalName", labelCle: "admparam_fiscalRaisonSociale", placeholder: "Ex. ELEGANZ SARL" },
  { cle: "platformFiscalIdNumber", labelCle: "admparam_fiscalNumeroId", placeholder: "Ex. NIU / RCCM" },
  { cle: "platformFiscalAddress", labelCle: "admparam_fiscalAdresse", placeholder: "Ex. Siège social — Kinshasa" },
  { cle: "platformFiscalRegime", labelCle: "admparam_fiscalRegime", placeholder: "Ex. Régime du réel" },
];

const CLES_CHAMPS: { cle: ChampTexte; labelCle: string; placeholder: string }[] = [
  { cle: "address", labelCle: "param_labelAdresse", placeholder: "Ex. 12 Avenue du Commerce, Gombe, Kinshasa" },
  { cle: "website", labelCle: "admparam_labelSiteWeb", placeholder: "https://eleganz-production.up.railway.app" },
  { cle: "supportEmail", labelCle: "admparam_labelEmailClientele", placeholder: "support@eleganz.cd" },
  { cle: "supportPhone", labelCle: "admparam_labelNumeroContact", placeholder: "+243 81 234 5678" },
  { cle: "whatsappLink", labelCle: "admparam_labelLienWhatsapp", placeholder: "https://wa.me/243812345678" },
  { cle: "telegramLink", labelCle: "admparam_labelLienTelegram", placeholder: "https://t.me/eleganz" },
  { cle: "tiktokUrl", labelCle: "admparam_labelTiktok", placeholder: "https://tiktok.com/@eleganz" },
  { cle: "instagramUrl", labelCle: "admparam_labelInstagram", placeholder: "https://instagram.com/eleganz" },
];

interface Compte {
  fullName: string;
  email: string | null;
  phone: string | null;
}

function ParametresContent() {
  const { t } = useLocale();
  const [valeurs, setValeurs] = useState<PlatformSettings>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  // Mon compte personnel (demande du 16 oct. 2026, point 2) — identité de
  // l'administrateur connecté, distincte des paramètres de la plateforme
  // ci-dessous.
  const [compte, setCompte] = useState<Compte | null>(null);
  const [editionCompte, setEditionCompte] = useState(false);
  const [nomEdite, setNomEdite] = useState("");
  const [emailEdite, setEmailEdite] = useState("");
  const [telephoneEdite, setTelephoneEdite] = useState("");
  const [enregistrementCompte, setEnregistrementCompte] = useState(false);
  const [erreurCompte, setErreurCompte] = useState<string | null>(null);

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

  useEffect(() => {
    api
      .get<PlatformSettings>("/admin/platform-settings")
      .then(setValeurs)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [t]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", valeurs);
      setValeurs(resultat);
      setConfirmation(t("admparam_confirmationEnregistrement"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admparam_enregistrementImpossible"));
    } finally {
      setEnregistrement(false);
    }
  }

  // Identité fiscale ELEGANZ (18 oct. 2026, audit du 18 oct. 2026, point 3)
  // — formulaire et PATCH séparés du bloc "Coordonnées & réseaux sociaux"
  // ci-dessus, pour ne jamais mélanger les deux soumissions.
  const [enregistrementFiscal, setEnregistrementFiscal] = useState(false);
  const [erreurFiscal, setErreurFiscal] = useState<string | null>(null);
  const [confirmationFiscal, setConfirmationFiscal] = useState<string | null>(null);

  async function enregistrerFiscal(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrementFiscal(true);
    setErreurFiscal(null);
    setConfirmationFiscal(null);
    try {
      const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
        platformFiscalLegalName: valeurs.platformFiscalLegalName,
        platformFiscalIdNumber: valeurs.platformFiscalIdNumber,
        platformFiscalAddress: valeurs.platformFiscalAddress,
        platformFiscalRegime: valeurs.platformFiscalRegime,
        platformFoundedAt: valeurs.platformFoundedAt,
      });
      setValeurs(resultat);
      setConfirmationFiscal(t("admparam_confirmationEnregistrement"));
    } catch (err) {
      setErreurFiscal(err instanceof ApiError ? err.message : t("admparam_enregistrementImpossible"));
    } finally {
      setEnregistrementFiscal(false);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admparam_titre")}</h1>
      <p className={styles.sousTitre}>{t("admparam_sousTitre")}</p>

      <h2 className={styles.titreSection}>{t("profil_informationsCompte")}</h2>
      {editionCompte ? (
        <form
          className={styles.formulaire}
          onSubmit={enregistrerCompte}
          style={{ marginBottom: "var(--espace-5)" }}
        >
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
          {erreurCompte && <p className={styles.erreur}>{erreurCompte}</p>}
          <div style={{ display: "flex", gap: "var(--espace-3)" }}>
            <button className={styles.boutonEnregistrer} type="submit" disabled={enregistrementCompte}>
              {enregistrementCompte ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
            </button>
            <button className={styles.boutonEnregistrer} type="button" onClick={() => setEditionCompte(false)}>
              {t("action_annuler")}
            </button>
          </div>
        </form>
      ) : (
        <div style={{ marginBottom: "var(--espace-5)" }}>
          <p>{t("activites_nom")} : {compte?.fullName ?? "…"}</p>
          <p>{t("profil_email")} : {compte?.email ?? t("profil_nonRenseigne")}</p>
          <p>{t("profil_telephone")} : {compte?.phone ?? t("profil_nonRenseigne")}</p>
          <button className={styles.boutonEnregistrer} onClick={ouvrirEditionCompte}>
            {t("profil_modifier")}
          </button>
        </div>
      )}

      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {confirmation && <p className={styles.confirmation}>{confirmation}</p>}

      <form className={styles.formulaire} onSubmit={enregistrer}>
        {CLES_CHAMPS.map((champ) => (
          <div className={styles.champ} key={champ.cle}>
            <label htmlFor={champ.cle}>{t(champ.labelCle)}</label>
            <input
              id={champ.cle}
              value={valeurs[champ.cle] ?? ""}
              onChange={(e) => setValeurs((v) => ({ ...v, [champ.cle]: e.target.value }))}
              placeholder={champ.placeholder}
            />
          </div>
        ))}
        <button className={styles.boutonEnregistrer} type="submit" disabled={enregistrement}>
          {enregistrement ? t("admparam_enregistrementEnCours") : t("action_enregistrer")}
        </button>
      </form>

      <h2 className={styles.titreSection}>{t("admparam_titreFiscal")}</h2>
      <p className={styles.sousTitre}>{t("admparam_fiscalSousTitre")}</p>
      {erreurFiscal && <p className={styles.erreur}>{erreurFiscal}</p>}
      {confirmationFiscal && <p className={styles.confirmation}>{confirmationFiscal}</p>}
      <form className={styles.formulaire} onSubmit={enregistrerFiscal}>
        {CLES_CHAMPS_FISCAL.map((champ) => (
          <div className={styles.champ} key={champ.cle}>
            <label htmlFor={champ.cle}>{t(champ.labelCle)}</label>
            <input
              id={champ.cle}
              value={valeurs[champ.cle] ?? ""}
              onChange={(e) => setValeurs((v) => ({ ...v, [champ.cle]: e.target.value }))}
              placeholder={champ.placeholder}
            />
          </div>
        ))}
        <div className={styles.champ}>
          <label htmlFor="platformFoundedAt">{t("admparam_fiscalDateCreation")}</label>
          <input
            id="platformFoundedAt"
            type="date"
            value={valeurs.platformFoundedAt ? valeurs.platformFoundedAt.slice(0, 10) : ""}
            onChange={(e) => setValeurs((v) => ({ ...v, platformFoundedAt: e.target.value || null }))}
          />
        </div>
        <button className={styles.boutonEnregistrer} type="submit" disabled={enregistrementFiscal}>
          {enregistrementFiscal ? t("admparam_enregistrementEnCours") : t("action_enregistrer")}
        </button>
      </form>

      <h2 className={styles.titreSection}>{t("admparam_titreChatbox")}</h2>
      <p className={styles.sousTitre}>{t("admparam_chatboxSousTitre")}</p>
      <div className={styles.listeBascules}>
        <label className={styles.bascule}>
          <input
            type="checkbox"
            checked={Boolean(valeurs.chatWidgetEnabled)}
            onChange={async (e) => {
              const coche = e.target.checked;
              setValeurs((v) => ({ ...v, chatWidgetEnabled: coche }));
              try {
                const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
                  chatWidgetEnabled: coche,
                });
                setValeurs(resultat);
              } catch (err) {
                setErreur(err instanceof ApiError ? err.message : t("admparam_enregistrementImpossible"));
              }
            }}
          />
          <div>
            <div className={styles.basculeLabel}>{t("admparam_afficherBulleChat")}</div>
            <div className={styles.basculeDescription}>{t("admparam_activeeParDefaut")}</div>
          </div>
        </label>
      </div>

      <h2 className={styles.titreSection}>{t("nav_notifications")}</h2>
      <p className={styles.sousTitre}>{t("admparam_notificationsSousTitre")}</p>
      <div className={styles.listeBascules}>
        {CLES_CANAUX_NOTIFICATION.map((canal) => (
          <label className={styles.bascule} key={canal.cle}>
            <input
              type="checkbox"
              checked={Boolean(valeurs[canal.cle])}
              onChange={async (e) => {
                const coche = e.target.checked;
                setValeurs((v) => ({ ...v, [canal.cle]: coche }));
                try {
                  const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
                    [canal.cle]: coche,
                  });
                  setValeurs(resultat);
                } catch (err) {
                  setErreur(err instanceof ApiError ? err.message : t("admparam_enregistrementImpossible"));
                }
              }}
            />
            <div>
              <div className={styles.basculeLabel}>{t(canal.labelCle)}</div>
              <div className={styles.basculeDescription}>{t(canal.descriptionCle)}</div>
            </div>
          </label>
        ))}
      </div>

      <h2 className={styles.titreSection}>{t("admparam_titreFonctionnalitesIA")}</h2>
      <p className={styles.sousTitre}>{t("admparam_iaSousTitre")}</p>
      <div className={styles.listeBascules}>
        {CLES_FONCTIONNALITES_IA.map((f) => (
          <label className={styles.bascule} key={f.cle}>
            <input
              type="checkbox"
              checked={Boolean(valeurs[f.cle])}
              onChange={async (e) => {
                const coche = e.target.checked;
                setValeurs((v) => ({ ...v, [f.cle]: coche }));
                try {
                  const resultat = await api.patch<PlatformSettings>("/admin/platform-settings", {
                    [f.cle]: coche,
                  });
                  setValeurs(resultat);
                } catch (err) {
                  setErreur(err instanceof ApiError ? err.message : t("admparam_enregistrementImpossible"));
                }
              }}
            />
            <div>
              <div className={styles.basculeLabel}>{t(f.labelCle)}</div>
              <div className={styles.basculeDescription}>{t(f.descriptionCle)}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function AdminParametresPage() {
  return (
    <AdminShell>
      <ParametresContent />
    </AdminShell>
  );
}
