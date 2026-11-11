"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "../components/SiteHeader";
import { Footer } from "../components/Footer";
import { api } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface QuestionFaq {
  titre: string;
  categorie: string;
  contenuClient: string;
  imagesClient: string[];
}

/**
 * FAQ publique de la plateforme (demande du 11 nov. 2026) — distincte de
 * `/aide/[slug]` (lien individuel transmis par un agent pour UNE fiche) :
 * cette page liste TOUTES les fiches du Centre d'aide interne marquées
 * `visibleFaq` par un agent ELEGANZ, groupées par catégorie. Aucune
 * authentification (même principe que `/aide/[slug]` et le catalogue
 * Marketplace) — un visiteur n'a pas de compte à ouvrir pour lire une
 * réponse. Ne reçoit du serveur que `contenuClient`/`imagesClient` ; voir
 * GuidesService.listerFaq côté API, qui filtre déjà ce qui est renvoyé.
 */
export default function AideFaqPage() {
  const { t } = useLocale();
  const [questions, setQuestions] = useState<QuestionFaq[] | null>(null);
  const [erreur, setErreur] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [categorieFiltre, setCategorieFiltre] = useState("");
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());

  useEffect(() => {
    api
      .get<QuestionFaq[]>("/guides/public-faq", false)
      .then(setQuestions)
      .catch(() => setErreur(true));
  }, []);

  const categories = useMemo(
    () => Array.from(new Set((questions ?? []).map((q) => q.categorie))).sort(),
    [questions],
  );

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (questions ?? []).filter((item) => {
      if (categorieFiltre && item.categorie !== categorieFiltre) return false;
      if (!q) return true;
      return item.titre.toLowerCase().includes(q) || item.contenuClient.toLowerCase().includes(q);
    });
  }, [questions, recherche, categorieFiltre]);

  const groupes = useMemo(() => {
    const parGroupe = new Map<string, QuestionFaq[]>();
    for (const item of filtrees) {
      const liste = parGroupe.get(item.categorie) ?? [];
      liste.push(item);
      parGroupe.set(item.categorie, liste);
    }
    return Array.from(parGroupe.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtrees]);

  function basculer(cle: string) {
    setOuvertes((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(cle)) suivant.delete(cle);
      else suivant.add(cle);
      return suivant;
    });
  }

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.corps}>
        <header className={styles.entete}>
          <h1 className={styles.titre}>{t("aide_faqTitre")}</h1>
          <p className={styles.sousTitre}>{t("aide_faqSousTitre")}</p>
        </header>

        {!erreur && (
          <div className={styles.barreOutils}>
            <input
              className={styles.champRecherche}
              placeholder={t("aide_faqRecherchePlaceholder")}
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
            {categories.length > 1 && (
              <select value={categorieFiltre} onChange={(e) => setCategorieFiltre(e.target.value)}>
                <option value="">{t("aide_toutesCategories")}</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {erreur && <p className={styles.messageVide}>{t("commun_erreur")}</p>}

        {!erreur && questions === null && <p className={styles.messageVide}>{t("commun_chargement")}</p>}

        {!erreur && questions !== null && groupes.length === 0 && (
          <p className={styles.messageVide}>
            {recherche.trim() || categorieFiltre ? t("aide_faqAucuneQuestion") : t("aide_faqVide")}
          </p>
        )}

        {groupes.map(([categorie, items]) => (
          <section className={styles.groupe} key={categorie}>
            {categories.length > 1 && <h2 className={styles.groupeTitre}>{categorie}</h2>}
            {items.map((item) => {
              const cle = `${categorie}__${item.titre}`;
              const ouverte = ouvertes.has(cle);
              return (
                <div className={styles.question} key={cle}>
                  <button
                    className={styles.questionBouton}
                    onClick={() => basculer(cle)}
                    aria-expanded={ouverte}
                  >
                    <span>{item.titre}</span>
                    <span
                      className={`${styles.questionChevron} ${ouverte ? styles.questionChevronOuvert : ""}`}
                      aria-hidden="true"
                    >
                      ⌄
                    </span>
                  </button>
                  {ouverte && (
                    <div className={styles.reponse}>
                      <p>{item.contenuClient}</p>
                      {item.imagesClient.length > 0 && (
                        <div className={styles.galerie}>
                          {item.imagesClient.map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </main>

      <Footer variante="accueil" />
    </div>
  );
}
