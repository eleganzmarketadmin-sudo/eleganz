"use client";

import { useEffect, useRef, useState } from "react";
import { InstitutionShell } from "../InstitutionShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

interface ProfilParametres {
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  headerNote?: string | null;
  footerNote?: string | null;
}

/**
 * Écran Paramètres du portail Institution (20 nov. 2026, demande du
 * propriétaire : "menu paramètre pour le portail institution afin de
 * libérer les infos avec les infos d'identification de l'institution [...]
 * avec entête personnalisé et/ou pied de page") — mirroring
 * apps/web/app/(gestion)/parametres/page.tsx (bloc "documents imprimés"),
 * mais appliqué aux 3 exports PDF du portail institution (dossier crédit,
 * candidature, rapport de portefeuille) plutôt qu'aux factures boutique.
 * L'édition elle-même reste réservée à ADMINISTRATEUR/GESTIONNAIRE_COMPTE
 * côté API (InstitutionRoles sur PATCH me/parametres) — jamais dupliqué ici
 * en barrière d'écran, voir le commentaire équivalent sur l'export PDF plus
 * haut dans le contrôleur.
 */
function ParametresInstitutionContenu() {
  const { t } = useLocale();
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [headerNote, setHeaderNote] = useState("");
  const [footerNote, setFooterNote] = useState("");

  const [televersementLogoEnCours, setTeleversementLogoEnCours] = useState(false);
  const inputLogoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    api
      .get<ProfilParametres>("/institution-portal/me")
      .then((profil) => {
        setContactEmail(profil.contactEmail ?? "");
        setContactPhone(profil.contactPhone ?? "");
        setAdresse(profil.address ?? "");
        setLogoUrl(profil.logoUrl ?? "");
        setHeaderNote(profil.headerNote ?? "");
        setFooterNote(profil.footerNote ?? "");
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("instParam_erreurChargement")))
      .finally(() => setChargement(false));
  }, [t]);

  async function televerserLogo(fichier: File) {
    setTeleversementLogoEnCours(true);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/institution-portal/me/parametres/logo-upload-url",
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!envoi.ok) {
        throw new Error(t("instParam_erreurEnvoiLogoReseau"));
      }
      setLogoUrl(publicUrl);
    } catch (err) {
      // Même distinction que (gestion)/parametres (televerserLogo) : fetch
      // vers R2 échoue en TypeError dès que la requête n'atteint jamais le
      // serveur (CORS, réseau, URL expirée).
      if (err instanceof TypeError) {
        setErreur(t("instParam_erreurEnvoiLogoReseau"));
      } else {
        setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("instParam_erreurEnvoiLogo"));
      }
    } finally {
      setTeleversementLogoEnCours(false);
    }
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch("/institution-portal/me/parametres", {
        contactEmail,
        contactPhone,
        address: adresse,
        logoUrl,
        headerNote,
        footerNote,
      });
      setConfirmation(t("instParam_confirmationEnregistrement"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("instParam_erreurEnregistrement"));
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) return <p>{t("instParam_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("inst_nav_parametres")}</h1>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("instParam_sectionTitre")}</h2>
        <p className={styles.note}>{t("instParam_note")}</p>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

        <form className={styles.formulaireVertical} onSubmit={enregistrer}>
          <div className={styles.champ}>
            <label htmlFor="contactEmail">{t("instParam_labelEmail")}</label>
            <input
              id="contactEmail"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              maxLength={200}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="contactPhone">{t("instParam_labelTelephone")}</label>
            <input
              id="contactPhone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              maxLength={50}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="adresse">{t("instParam_labelAdresse")}</label>
            <input
              id="adresse"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder={t("instParam_placeholderAdresse")}
              maxLength={200}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="logoUrl">{t("instParam_labelLogo")}</label>
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
                {televersementLogoEnCours ? t("instParam_televersementLogoEnCours") : t("instParam_televerserLogo")}
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
            <label htmlFor="headerNote">{t("instParam_labelEnTete")}</label>
            <input
              id="headerNote"
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              placeholder={t("instParam_placeholderEnTete")}
              maxLength={300}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="footerNote">{t("instParam_labelPiedPage")}</label>
            <textarea
              id="footerNote"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              rows={2}
              placeholder={t("instParam_placeholderPiedPage")}
              maxLength={300}
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enregistrement}>
            {enregistrement ? t("instParam_enregistrementEnCours") : t("instParam_enregistrer")}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function ParametresInstitutionPage() {
  return (
    <InstitutionShell>
      <ParametresInstitutionContenu />
    </InstitutionShell>
  );
}
