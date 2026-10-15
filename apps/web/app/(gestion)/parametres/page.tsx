"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { ZonesLivraison } from "../../components/ZonesLivraison";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface ShopDetails {
  id: string;
  name: string;
  invoiceAddress?: string | null;
  invoicePhone?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceFooterNote?: string | null;
}

function ParametresContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [noteBasPage, setNoteBasPage] = useState("");

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
        setNoteBasPage(shop.invoiceFooterNote ?? "");
      })
      .catch((err) =>
        setErreur(
          err instanceof Error ? err.message : t("param_erreurChargement"),
        ),
      )
      .finally(() => setChargement(false));
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
        invoiceFooterNote: noteBasPage,
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

  if (chargement) return <p>{t("param_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_parametres")}</h1>

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
          <button className={styles.bouton} type="submit" disabled={enregistrement}>
            {enregistrement ? t("param_enregistrementEnCours") : t("param_enregistrer")}
          </button>
        </form>
      </section>

      {currentShop && (
        <section className={styles.section}>
          <h2 className={styles.sousTitre}>{t("zonesLivraison_titre")}</h2>
          <p className={styles.note}>{t("zonesLivraison_description")}</p>
          <ZonesLivraison shopId={currentShop.id} />
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
