"use client";

import { useEffect, useRef, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface ParametresComptable {
  address?: string | null;
  logoUrl?: string | null;
  headerNote?: string | null;
  footerNote?: string | null;
}

/**
 * Écran Paramètres d'ELEGANZ Mon assistant (20 nov. 2026, étalage du
 * en-tête/pied de page personnalisés déjà livré pour le portail
 * Institution) — mirroring exact de institution/parametres/page.tsx, sans
 * les champs email/téléphone de contact : ces informations personnelles
 * restent éditées sur /comptable/profil (identité du compte ELEGANZ, pas de
 * l'activité). Les 4 champs ici ne touchent que l'identité affichée sur les
 * documents PDF exportés (synthèse périodique, dossier de financement) —
 * voir ComptableService.identitePourPdf.
 */
function ParametresComptableContenu() {
  const { t } = useLocale();
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

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
      .get<ParametresComptable>("/comptable/subscription")
      .then((profil) => {
        setAdresse(profil.address ?? "");
        setLogoUrl(profil.logoUrl ?? "");
        setHeaderNote(profil.headerNote ?? "");
        setFooterNote(profil.footerNote ?? "");
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("comptParam_erreurChargement")))
      .finally(() => setChargement(false));
  }, [t]);

  async function televerserLogo(fichier: File) {
    setTeleversementLogoEnCours(true);
    setErreur(null);
    try {
      const { uploadUrl, publicUrl } = await api.post<{ uploadUrl: string; publicUrl: string }>(
        "/comptable/me/parametres/logo-upload-url",
        { contentType: fichier.type },
      );
      const envoi = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fichier.type },
        body: fichier,
      });
      if (!envoi.ok) {
        throw new Error(t("comptParam_erreurEnvoiLogoReseau"));
      }
      setLogoUrl(publicUrl);
    } catch (err) {
      // Même distinction que (gestion)/parametres et institution/parametres
      // (televerserLogo) : fetch vers le stockage objet échoue en
      // TypeError dès que la requête n'atteint jamais le serveur (CORS,
      // réseau, URL expirée).
      if (err instanceof TypeError) {
        setErreur(t("comptParam_erreurEnvoiLogoReseau"));
      } else {
        setErreur(err instanceof ApiError || err instanceof Error ? err.message : t("comptParam_erreurEnvoiLogo"));
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
      await api.patch("/comptable/me/parametres", {
        address: adresse,
        logoUrl,
        headerNote,
        footerNote,
      });
      setConfirmation(t("comptParam_confirmationEnregistrement"));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("comptParam_erreurEnregistrement"));
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) return <p>{t("comptParam_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_parametres")}</h1>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("comptParam_sectionTitre")}</h2>
        <p className={styles.note}>{t("comptParam_note")}</p>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

        <form className={styles.formulaireVertical} onSubmit={enregistrer}>
          <div className={styles.champ}>
            <label htmlFor="adresse">{t("comptParam_labelAdresse")}</label>
            <input
              id="adresse"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder={t("comptParam_placeholderAdresse")}
              maxLength={200}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="logoUrl">{t("comptParam_labelLogo")}</label>
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
                {televersementLogoEnCours ? t("comptParam_televersementLogoEnCours") : t("comptParam_televerserLogo")}
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
            <label htmlFor="headerNote">{t("comptParam_labelEnTete")}</label>
            <input
              id="headerNote"
              value={headerNote}
              onChange={(e) => setHeaderNote(e.target.value)}
              placeholder={t("comptParam_placeholderEnTete")}
              maxLength={300}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="footerNote">{t("comptParam_labelPiedPage")}</label>
            <textarea
              id="footerNote"
              value={footerNote}
              onChange={(e) => setFooterNote(e.target.value)}
              rows={2}
              placeholder={t("comptParam_placeholderPiedPage")}
              maxLength={300}
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enregistrement}>
            {enregistrement ? t("comptParam_enregistrementEnCours") : t("comptParam_enregistrer")}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function ParametresComptablePage() {
  return (
    <ComptableShell>
      <ParametresComptableContenu />
    </ComptableShell>
  );
}
