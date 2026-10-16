"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { RetourLien } from "../../../components/RetourLien";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

type Template = "CLASSIQUE" | "MODERNE" | "CREATIF";

interface ExpertProfilPublic {
  id: string;
  headline: string;
  bio: string;
  domaines: string[];
  conditions: string | null;
  template: Template;
  photoUrl: string | null;
  user: { fullName: string };
}

// Profil public d'un expert (module Experts, 16 oct. 2026, points 2 et 3) —
// le gabarit (CLASSIQUE/MODERNE/CREATIF) choisi par l'expert ne change que
// la présentation visuelle (data-template sur .cadre), jamais le contenu.
// Les "conditions" (tarifs, modalités) sont affichées à titre purement
// informatif : aucune passerelle de paiement n'est proposée depuis cette
// page. CV, diplômes, certifications et personnes de référence ne sont
// jamais publiés ici (données personnelles réservées à la modération admin).
export default function ExpertProfilPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { t } = useLocale();

  const [expert, setExpert] = useState<ExpertProfilPublic | null>(null);
  const [erreurProfil, setErreurProfil] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ExpertProfilPublic>(`/experts/${params.id}`, false)
      .then(setExpert)
      .catch((err) => setErreurProfil(err instanceof Error ? err.message : t("experts_introuvable")));
  }, [params.id, t]);

  async function envoyerMessage() {
    if (!expert || !message.trim()) return;
    setEnvoiEnCours(true);
    setErreurEnvoi(null);
    try {
      await api.post(`/messagerie/conversations/expert/${expert.id}`, { message: message.trim() });
      setMessage("");
      setEnvoye(true);
    } catch (err) {
      setErreurEnvoi(err instanceof ApiError ? err.message : t("experts_envoiEchec"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (erreurProfil) return <p style={{ padding: "48px" }}>{erreurProfil}</p>;
  if (!expert) return <p style={{ padding: "48px" }}>{t("commun_chargement")}</p>;

  const initiale = expert.user.fullName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={styles.cadre} data-template={expert.template}>
      <div style={{ padding: "16px 20px 0" }}>
        <RetourLien href="/marketplace/experts" />
      </div>

      <div className={styles.entete}>
        {expert.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={expert.photoUrl} alt={expert.user.fullName} className={styles.avatar} />
        ) : (
          <div className={styles.avatar}>{initiale}</div>
        )}
        <div>
          <h1 className={styles.nom}>{expert.user.fullName}</h1>
          <p className={styles.headline}>{expert.headline}</p>
          <div className={styles.domaines}>
            {expert.domaines.map((d) => (
              <span className={styles.domaine} key={d}>
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.corps}>
        <div className={styles.section}>
          <h2 className={styles.titreSection}>{t("experts_presentation")}</h2>
          <p className={styles.bio}>{expert.bio}</p>
        </div>

        {expert.conditions && (
          <div className={styles.section}>
            <h2 className={styles.titreSection}>{t("experts_conditions")}</h2>
            <p className={styles.bio}>{expert.conditions}</p>
            <p className={styles.vide} style={{ marginTop: "8px", fontSize: "0.8125rem" }}>
              {t("experts_conditionsInformatif")}
            </p>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.titreSection}>{t("experts_contacter")}</h2>
          {!user ? (
            <p className={styles.vide}>
              <Link href={`/marketplace/compte?retour=/marketplace/experts/${expert.id}`} className={styles.lien}>
                {t("experts_seConnecterPourContacter")}
              </Link>
            </p>
          ) : envoye ? (
            <div className={styles.confirmation}>
              {t("boutique_messageEnvoye")}{" "}
              <Link href="/marketplace/messagerie" className={styles.lien}>
                {t("boutique_voirMessagerie")}
              </Link>
            </div>
          ) : (
            <div className={styles.formulaire}>
              <textarea
                placeholder={t("boutique_placeholderMessage")}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
              {erreurEnvoi && <div className={styles.erreur}>{erreurEnvoi}</div>}
              <button className={styles.boutonEnvoyer} onClick={envoyerMessage} disabled={envoiEnCours || !message.trim()}>
                {envoiEnCours ? t("avis_envoiEnCours") : t("boutique_envoyer")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
