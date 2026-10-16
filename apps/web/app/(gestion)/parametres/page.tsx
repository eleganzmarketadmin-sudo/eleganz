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
  slug: string;
  isPubliclyListed: boolean;
  invoiceAddress?: string | null;
  invoicePhone?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceFooterNote?: string | null;
}

interface Compte {
  fullName: string;
  email: string | null;
  phone: string | null;
}

function ParametresContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
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

  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [noteBasPage, setNoteBasPage] = useState("");
  const [slug, setSlug] = useState("");
  const [publiee, setPubliee] = useState(false);
  const [lienCopie, setLienCopie] = useState(false);

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
        setSlug(shop.slug);
        setPubliee(shop.isPubliclyListed);
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
          <h2 className={styles.sousTitre}>{t("param_lienBoutiqueTitre")}</h2>
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
