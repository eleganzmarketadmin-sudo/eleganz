"use client";

import { useState } from "react";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./Graphiques.module.css";

interface PointHistorique {
  date: string;
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

interface LigneComparaison {
  activityId: string;
  activityName: string;
  resultatCdf: number;
  resultatUsd: number;
}

function formatDateCourte(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(d);
}

/**
 * Courbe d'évolution ventes/dépenses sur N jours, pour une devise (prompt
 * §10.3) — jamais CDF et USD sur le même graphique (deux axes différents
 * pour la même grandeur serait trompeur, cf. règle « un seul axe »), donc un
 * petit multiple par devise plutôt qu'un graphique à double échelle.
 * Construit en SVG pur, sans bibliothèque de graphiques (infrastructure
 * légère exigée au tarif de 1 $/mois du module, prompt §19).
 */
export function GraphiqueEvolution({ items, currency }: { items: PointHistorique[]; currency: "CDF" | "USD" }) {
  const { t } = useLocale();
  const [survol, setSurvol] = useState<number | null>(null);
  const [vueTableau, setVueTableau] = useState(false);

  const cleVentes = currency === "CDF" ? "ventesCdf" : "ventesUsd";
  const cleDepenses = currency === "CDF" ? "depensesCdf" : "depensesUsd";
  const valeurs = items.flatMap((p) => [p[cleVentes], p[cleDepenses]]);
  const max = Math.max(...valeurs, 1);

  const largeur = 640;
  const hauteur = 200;
  const marge = { haut: 12, bas: 28, gauche: 8, droite: 8 };
  const zoneL = largeur - marge.gauche - marge.droite;
  const zoneH = hauteur - marge.haut - marge.bas;

  const x = (i: number) => marge.gauche + (items.length <= 1 ? zoneL / 2 : (i / (items.length - 1)) * zoneL);
  const y = (v: number) => marge.haut + zoneH - (v / max) * zoneH;

  const chemin = (cle: "ventesCdf" | "ventesUsd" | "depensesCdf" | "depensesUsd") =>
    items.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[cle]).toFixed(1)}`).join(" ");

  const indicesLabels = items.length > 1 ? [0, Math.floor((items.length - 1) / 2), items.length - 1] : [0];

  return (
    <div className={styles.carte}>
      <div className={styles.entete}>
        <span className={styles.titreGraphique}>{t("graph_evolutionSur").replace("{{jours}}", String(items.length))} — {currency}</span>
        <button className={styles.boutonBascule} onClick={() => setVueTableau((v) => !v)}>
          {vueTableau ? t("graph_voirGraphique") : t("graph_voirTableau")}
        </button>
      </div>

      <div className={styles.legende}>
        <span className={styles.legendeItem}>
          <span className={styles.pastilleVentes} /> {t("chiffres_ventes")}
        </span>
        <span className={styles.legendeItem}>
          <span className={styles.pastilleDepenses} /> {t("chiffres_depenses")}
        </span>
      </div>

      {vueTableau ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("cha_colDate")}</th>
              <th>{t("chiffres_ventes")}</th>
              <th>{t("chiffres_depenses")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.date}>
                <td>{formatDateCourte(p.date)}</td>
                <td>{formatMoney(p[cleVentes], currency)}</td>
                <td>{formatMoney(p[cleDepenses], currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <svg
          viewBox={`0 0 ${largeur} ${hauteur}`}
          className={styles.svg}
          role="img"
          aria-label={t("graph_ariaEvolution").replace("{{devise}}", currency).replace("{{jours}}", String(items.length))}
        >
          <line x1={marge.gauche} y1={y(0)} x2={largeur - marge.droite} y2={y(0)} className={styles.axe} />
          <path d={chemin(cleVentes)} className={styles.ligneVentes} fill="none" />
          <path d={chemin(cleDepenses)} className={styles.ligneDepenses} fill="none" />
          {items.map((p, i) => (
            <g key={p.date}>
              <circle
                cx={x(i)}
                cy={y(p[cleVentes])}
                r={survol === i ? 5 : 3}
                className={styles.pointVentes}
                onMouseEnter={() => setSurvol(i)}
                onMouseLeave={() => setSurvol(null)}
              />
              <circle
                cx={x(i)}
                cy={y(p[cleDepenses])}
                r={survol === i ? 5 : 3}
                className={styles.pointDepenses}
                onMouseEnter={() => setSurvol(i)}
                onMouseLeave={() => setSurvol(null)}
              />
            </g>
          ))}
          {indicesLabels.map((i) => (
            <text key={i} x={x(i)} y={hauteur - 6} className={styles.etiquetteAxe} textAnchor="middle">
              {formatDateCourte(items[i].date)}
            </text>
          ))}
          {survol !== null && (
            <g transform={`translate(${Math.min(Math.max(x(survol), 70), largeur - 70)}, 14)`}>
              <rect x={-66} y={-12} width={132} height={44} className={styles.infobulleFond} />
              <text x={0} y={2} textAnchor="middle" className={styles.infobulleTitre}>
                {formatDateCourte(items[survol].date)}
              </text>
              <text x={0} y={18} textAnchor="middle" className={styles.infobulleTexte}>
                {t("graph_abrevVentes")} {formatMoney(items[survol][cleVentes], currency)} · {t("graph_abrevDepenses")} {formatMoney(items[survol][cleDepenses], currency)}
              </text>
            </g>
          )}
        </svg>
      )}
    </div>
  );
}

/**
 * Comparaison du résultat net par activité sur le mois en cours (prompt
 * §10.3) — barres divergentes autour de zéro (vert = positif, flamme =
 * négatif), jamais de fusion entre activités (prompt §2).
 */
export function GraphiqueComparaison({ items, currency }: { items: LigneComparaison[]; currency: "CDF" | "USD" }) {
  const { t } = useLocale();
  const [vueTableau, setVueTableau] = useState(false);
  const cle = currency === "CDF" ? "resultatCdf" : "resultatUsd";
  const maxAbs = Math.max(...items.map((i) => Math.abs(i[cle])), 1);

  if (items.length === 0) return null;

  return (
    <div className={styles.carte}>
      <div className={styles.entete}>
        <span className={styles.titreGraphique}>{t("graph_comparaisonParActivite")} — {currency}</span>
        <button className={styles.boutonBascule} onClick={() => setVueTableau((v) => !v)}>
          {vueTableau ? t("graph_voirGraphique") : t("graph_voirTableau")}
        </button>
      </div>

      {vueTableau ? (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("graph_activite")}</th>
              <th>{t("graph_resultatNet")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.activityId}>
                <td>{i.activityName}</td>
                <td className={i[cle] >= 0 ? styles.positif : styles.negatif}>{formatMoney(i[cle], currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.barresDivergentes}>
          {items.map((i) => {
            const valeur = i[cle];
            const pourcentage = (Math.abs(valeur) / maxAbs) * 50;
            return (
              <div className={styles.ligneBarre} key={i.activityId}>
                <span className={styles.nomActivite}>{i.activityName}</span>
                <div className={styles.pisteBarre}>
                  <div className={styles.axeCentral} />
                  <div
                    className={valeur >= 0 ? styles.barrePositive : styles.barreNegative}
                    style={
                      valeur >= 0
                        ? { left: "50%", width: `${pourcentage}%` }
                        : { right: "50%", width: `${pourcentage}%` }
                    }
                  />
                </div>
                <span className={valeur >= 0 ? styles.positif : styles.negatif}>{formatMoney(valeur, currency)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
