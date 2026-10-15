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

function ParametresContent() {
  const { t } = useLocale();
  const [valeurs, setValeurs] = useState<PlatformSettings>({});
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

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

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admparam_titre")}</h1>
      <p className={styles.sousTitre}>{t("admparam_sousTitre")}</p>

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
