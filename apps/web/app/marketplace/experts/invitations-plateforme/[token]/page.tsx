"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth";
import { useLocale } from "../../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface ApercuInvitePlateforme {
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt: string;
  scopes: string[];
}

// Pendant plateforme de /marketplace/experts/invitations/[token]/page.tsx
// (16 oct. 2026, point 2 — "ajouter le bloc d'invitation Experts
// externes... comme déjà actif dans eleganz gestion") : même flux
// (compte ELEGANZ déjà connecté requis, pas de création de compte à la
// volée depuis ce lien), mais pour un accès au Centre de pilotage plutôt
// qu'à une boutique.
export default function AccepterInviteExpertPlateformePage() {
  const params = useParams<{ token: string }>();
  const { user } = useAuth();
  const { t } = useLocale();

  const [apercu, setApercu] = useState<ApercuInvitePlateforme | null>(null);
  const [erreurApercu, setErreurApercu] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [accepte, setAccepte] = useState(false);

  useEffect(() => {
    api
      .get<ApercuInvitePlateforme>(`/experts/plateforme/invitations/${params.token}`, false)
      .then(setApercu)
      .catch((err) => setErreurApercu(err instanceof Error ? err.message : t("experts_invitationIntrouvable")));
  }, [params.token, t]);

  async function accepter() {
    setEnCours(true);
    setErreur(null);
    try {
      await api.post(`/experts/plateforme/invitations/${params.token}/accepter`);
      setAccepte(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("experts_acceptationEchec"));
    } finally {
      setEnCours(false);
    }
  }

  if (erreurApercu) return <p style={{ padding: "48px", textAlign: "center" }}>{erreurApercu}</p>;
  if (!apercu) return <p style={{ padding: "48px", textAlign: "center" }}>{t("commun_chargement")}</p>;

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("experts_invitationTitrePlateforme")}</h1>

      <div className={styles.scopes}>
        {apercu.scopes.map((s) => (
          <span className={styles.scope} key={s}>
            {s}
          </span>
        ))}
      </div>

      {apercu.status !== "PENDING" ? (
        <p className={styles.erreur}>{t("experts_invitationPlusValide")}</p>
      ) : accepte ? (
        <div className={styles.confirmation}>
          {t("experts_invitationAccepteePlateforme")}{" "}
          <Link href="/marketplace/experts/moi" className={styles.lien}>
            {t("experts_voirMonProfil")}
          </Link>
        </div>
      ) : !user ? (
        <p>
          <Link
            href={`/marketplace/compte?retour=/marketplace/experts/invitations-plateforme/${params.token}`}
            className={styles.lien}
          >
            {t("experts_seConnecterPourAccepter")}
          </Link>
        </p>
      ) : (
        <div>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <button className={styles.bouton} onClick={accepter} disabled={enCours}>
            {enCours ? t("experts_acceptationEnCours") : t("experts_accepterInvitation")}
          </button>
        </div>
      )}
    </div>
  );
}
