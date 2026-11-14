"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { ChampMotDePasse } from "../../components/ChampMotDePasse";
import { BoutonAccueilPlateforme } from "../../components/BoutonAccueilPlateforme";
import styles from "./page.module.css";

const TYPES_INSTITUTION = ["MICROFINANCE", "BANQUE", "COOPERATIVE", "AUTRE"] as const;
type TypeInstitution = (typeof TYPES_INSTITUTION)[number];

/**
 * Auto-inscription institution (14 nov. 2026, revirement — voir le
 * commentaire sur connexion/page.tsx et sur Institution dans schema.prisma).
 * Deux appels successifs, même principe que pour un livreur ou un
 * acheteur : /auth/register crée d'abord le compte ELEGANZ avec
 * role=INSTITUTION_STAFF (voir RegisterDto), puis
 * POST /institution-portal/inscription crée le profil Institution associé,
 * toujours au statut PENDING (jamais ACTIF d'emblée — seul un admin ELEGANZ
 * peut faire basculer ce statut, voir AdminInstitutionsService.setStatus /
 * .reject). Si le second appel échoue alors que le premier a réussi, le
 * compte existe déjà sans profil institution : on l'explique plutôt que de
 * renvoyer silencieusement vers la connexion (voir le message d'erreur
 * dédié ci-dessous).
 */
export default function InscriptionInstitutionPage() {
  const { register } = useAuth();
  const { t } = useLocale();
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<TypeInstitution>("MICROFINANCE");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse.length < 8) {
      setErreur(t("compte_motDePasseCourt"));
      return;
    }
    setEnCours(true);
    try {
      await register({ fullName, identifiant, motDePasse, role: "INSTITUTION_STAFF" });
      try {
        await api.post("/institution-portal/inscription", {
          name,
          type,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
        });
      } catch (err) {
        // Le compte ELEGANZ existe déjà à ce stade (register() a réussi) —
        // on ne peut pas faire disparaître ça, donc on l'explique au lieu
        // de renvoyer un message d'inscription générique trompeur.
        setErreur(
          err instanceof ApiError
            ? err.message
            : "Votre compte a été créé, mais l'enregistrement du profil institution a échoué. Reconnectez-vous puis réessayez, ou contactez le support ELEGANZ.",
        );
        setEnCours(false);
        return;
      }
      window.location.href = "/institution";
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("ginscription_erreur"));
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <BoutonAccueilPlateforme />
        <h1>{t("inst_inscription_titreMarque")}</h1>
        <p>{t("inst_inscription_texteMarque")}</p>
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre} suppressHydrationWarning>
          <h2 style={{ marginBottom: "24px" }}>{t("inst_inscription_titre")}</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}

          <div className={styles.champ}>
            <label htmlFor="name">{t("admInst_labelNom")}</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className={styles.champ}>
            <label htmlFor="type">{t("admInst_labelType")}</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as TypeInstitution)}>
              {TYPES_INSTITUTION.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`inst_type_${tp}`)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.champ}>
            <label htmlFor="contactEmail">{t("admInst_labelContactEmail")}</label>
            <input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div className={styles.champ}>
            <label htmlFor="contactPhone">{t("admInst_labelContactTelephone")}</label>
            <input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>

          <hr className={styles.separateur} />

          <div className={styles.champ}>
            <label htmlFor="fullName">{t("compte_nomComplet")}</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              suppressHydrationWarning
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="identifiant">{t("compte_emailOuTelephone")}</label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
              suppressHydrationWarning
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">{t("ginscription_labelMotDePasse")}</label>
            <ChampMotDePasse
              id="motDePasse"
              autoComplete="new-password"
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>

          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? t("ginscription_enCours") : t("inst_creerCompte")}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            {t("ginscription_dejaCompte")} <Link href="/institution/connexion">{t("compte_seConnecter")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
