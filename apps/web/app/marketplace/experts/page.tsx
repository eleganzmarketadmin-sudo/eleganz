"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

// Annuaire public des experts ELEGANZ (module Experts, 16 oct. 2026, point
// 2) — "on peut chercher un expert de n'importe quel domaine [...] l'idée
// est d'offrir aux secteurs informel une expertise et contre-expertise
// [...] et lui-même choisira son expert en fonction de la présentation, du
// profil dans ELEGANZ". Ne liste que les profils APPROVED par un admin
// (voir ExpertsService.rechercher, filtré côté API).
interface ExpertAnnuaire {
  id: string;
  headline: string;
  bio: string;
  domaines: string[];
  user: { fullName: string };
}

export default function ExpertsPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [recherche, setRecherche] = useState("");
  const [requeteActive, setRequeteActive] = useState("");
  const [experts, setExperts] = useState<ExpertAnnuaire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    const params = new URLSearchParams();
    if (requeteActive) params.set("q", requeteActive);
    const chaine = params.toString();
    api
      .get<ExpertAnnuaire[]>(`/experts${chaine ? `?${chaine}` : ""}`, false)
      .then((data) => {
        if (!annule) setExperts(data);
      })
      .catch((err) => {
        if (!annule) setErreur(err instanceof Error ? err.message : t("experts_erreur"));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [requeteActive]);

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <h1>{t("experts_titre")}</h1>
        <p>{t("experts_sousTitre")}</p>
        <div className={styles.liensEntete}>
          <Link href={user ? "/marketplace/experts/postuler" : "/marketplace/compte?retour=/marketplace/experts/postuler"}>
            {t("experts_devenirExpert")}
          </Link>
        </div>
      </div>

      <form
        className={styles.barreRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          setRequeteActive(recherche);
        }}
      >
        <input
          placeholder={t("experts_rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </form>

      {chargement ? (
        <p className={styles.messageVide}>{t("commun_chargement")}</p>
      ) : erreur ? (
        <p className={styles.messageVide}>{erreur}</p>
      ) : experts.length === 0 ? (
        <p className={styles.messageVide}>{t("experts_aucunExpert")}</p>
      ) : (
        <div className={styles.liste}>
          {experts.map((expert) => (
            <Link className={styles.carte} href={`/marketplace/experts/${expert.id}`} key={expert.id}>
              <div className={styles.nomExpert}>{expert.user.fullName}</div>
              <div className={styles.headline}>{expert.headline}</div>
              <div className={styles.domaines}>
                {expert.domaines.map((d) => (
                  <span className={styles.domaine} key={d}>
                    {d}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
