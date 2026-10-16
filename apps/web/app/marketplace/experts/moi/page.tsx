"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "../../../lib/api";
import { useAuth } from "../../../lib/auth";
import { RetourLien } from "../../../components/RetourLien";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface MonProfilExpert {
  id: string;
  headline: string;
  bio: string;
  domaines: string[];
  conditions: string | null;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "SUSPENDED";
  statusNote: string | null;
}

interface Engagement {
  id: string;
  scopes: string[];
  shop: { id: string; name: string; slug: string };
}

// "Devenir expert" / profil personnel (module Experts, 16 oct. 2026, point
// 2) — n'importe quel compte ELEGANZ peut postuler ; toute modification
// repasse en attente de modération (voir ExpertsService.candidater). Les
// pages "postuler" et "moi" pointent ici : postuler EST éditer son propre
// profil, il n'y a qu'un seul formulaire.
export default function MonProfilExpertPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();

  const [profil, setProfil] = useState<MonProfilExpert | null>(null);
  const [chargement, setChargement] = useState(true);
  const [engagements, setEngagements] = useState<Engagement[]>([]);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [domaines, setDomaines] = useState("");
  const [conditions, setConditions] = useState("");

  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get<MonProfilExpert | null>("/experts/moi/profil")
      .then((data) => {
        setProfil(data);
        if (data) {
          setHeadline(data.headline);
          setBio(data.bio);
          setDomaines(data.domaines.join(", "));
          setConditions(data.conditions ?? "");
        }
      })
      .finally(() => setChargement(false));
    api
      .get<Engagement[]>("/experts/moi/engagements")
      .then(setEngagements)
      .catch(() => setEngagements([]));
  }, [user]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setEnCours(true);
    setErreur(null);
    setConfirmation(false);
    try {
      const data = await api.post<MonProfilExpert>("/experts/moi/profil", {
        headline: headline.trim(),
        bio: bio.trim(),
        domaines: domaines
          .split(",")
          .map((d) => d.trim())
          .filter(Boolean),
        conditions: conditions.trim() || undefined,
      });
      setProfil(data);
      setConfirmation(true);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("experts_erreurCandidature"));
    } finally {
      setEnCours(false);
    }
  }

  if (!user) {
    return (
      <div className={styles.cadre}>
        <p className={styles.vide}>
          <Link href="/marketplace/compte?retour=/marketplace/experts/moi">{t("experts_seConnecterPourPostuler")}</Link>
        </p>
      </div>
    );
  }

  if (chargement) {
    return <p style={{ padding: "48px" }}>{t("commun_chargement")}</p>;
  }

  const badgeClasse =
    profil?.status === "APPROVED"
      ? styles.badgeApprouve
      : profil?.status === "REJECTED"
        ? styles.badgeRejete
        : profil?.status === "SUSPENDED"
          ? styles.badgeSuspendu
          : styles.badgeEnAttente;

  const libelleStatut =
    profil?.status === "APPROVED"
      ? t("experts_statutApprouve")
      : profil?.status === "REJECTED"
        ? t("experts_statutRejete")
        : profil?.status === "SUSPENDED"
          ? t("experts_statutSuspendu")
          : t("experts_statutEnAttente");

  return (
    <div className={styles.cadre}>
      <RetourLien href="/marketplace/experts" />
      <h1 className={styles.titre}>{t("experts_monProfilTitre")}</h1>
      <p className={styles.sousTitre}>{t("experts_monProfilSousTitre")}</p>

      {profil && (
        <div>
          <span className={`${styles.badge} ${badgeClasse}`}>{libelleStatut}</span>
          {profil.statusNote && <p className={styles.aide}>{profil.statusNote}</p>}
        </div>
      )}

      <form onSubmit={enregistrer}>
        <div className={styles.champ}>
          <label htmlFor="headline">{t("experts_labelHeadline")}</label>
          <input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} required minLength={3} maxLength={120} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="bio">{t("experts_labelBio")}</label>
          <textarea id="bio" rows={6} value={bio} onChange={(e) => setBio(e.target.value)} required minLength={20} maxLength={4000} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="domaines">{t("experts_labelDomaines")}</label>
          <input id="domaines" value={domaines} onChange={(e) => setDomaines(e.target.value)} required placeholder={t("experts_placeholderDomaines")} />
          <p className={styles.aide}>{t("experts_aideDomaines")}</p>
        </div>
        <div className={styles.champ}>
          <label htmlFor="conditions">{t("experts_labelConditions")}</label>
          <textarea id="conditions" rows={4} value={conditions} onChange={(e) => setConditions(e.target.value)} maxLength={4000} />
          <p className={styles.aide}>{t("experts_aideConditionsInformatif")}</p>
        </div>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{t("experts_candidatureEnregistree")}</div>}

        <button className={styles.bouton} type="submit" disabled={enCours}>
          {enCours ? t("experts_enregistrementEnCours") : profil ? t("experts_mettreAJour") : t("experts_envoyerCandidature")}
        </button>
      </form>

      {profil?.status === "APPROVED" && (
        <div className={styles.section}>
          <h2>{t("experts_mesBoutiquesTitre")}</h2>
          {engagements.length === 0 ? (
            <p className={styles.vide}>{t("experts_aucuneBoutiqueEngagee")}</p>
          ) : (
            engagements.map((e) => (
              <div className={styles.ligne} key={e.id}>
                <span>{e.shop.name}</span>
                <span className={styles.aide}>{e.scopes.join(", ")}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
