"use client";

import { useState } from "react";
import { formatMoney } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

export interface PointEvolution {
  periode: string;
  label: string;
  salesCount: number;
  revenue: number;
  confirmedCollections: number;
  panierMoyen: number;
  grossMargin: number | null;
  marginReliable: boolean;
}

const LARGEUR = 600;
const HAUTEUR = 220;
const MARGE_GAUCHE = 48;
const MARGE_DROITE = 12;
const MARGE_HAUT = 16;
const MARGE_BAS = 28;
const LARGEUR_UTILE = LARGEUR - MARGE_GAUCHE - MARGE_DROITE;
const HAUTEUR_UTILE = HAUTEUR - MARGE_HAUT - MARGE_BAS;

function x(i: number, n: number): number {
  if (n <= 1) return MARGE_GAUCHE + LARGEUR_UTILE / 2;
  return MARGE_GAUCHE + (i / (n - 1)) * LARGEUR_UTILE;
}

function arrondiEchelle(valeurMax: number): number {
  if (valeurMax <= 0) return 1;
  const puissance = Math.pow(10, Math.floor(Math.log10(valeurMax)));
  const ratio = valeurMax / puissance;
  const facteur = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10;
  return facteur * puissance;
}

// Index du point le plus proche du curseur, en convertissant la position
// écran de la souris en coordonnées du viewBox (le SVG est dessiné en
// largeur responsive via viewBox, donc on ne peut pas comparer clientX
// directement aux coordonnées internes).
function indexAuSurvol(e: React.MouseEvent<SVGSVGElement>, n: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const xViewBox = ratio * LARGEUR;
  if (n <= 1) return 0;
  const brut = ((xViewBox - MARGE_GAUCHE) / LARGEUR_UTILE) * (n - 1);
  return Math.min(n - 1, Math.max(0, Math.round(brut)));
}

function graduations(valeurMax: number): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((f) => f * valeurMax);
}

function pasEtiquettes(n: number): number {
  return Math.max(1, Math.ceil(n / 8));
}

// L'infobulle est centrée horizontalement sur le point survolé
// (translateX(-50%)) : sans borne, elle déborderait hors de la zone de
// graphique quand le point survolé est le premier ou le dernier — surtout
// visible sur un écran étroit où la boîte occupe une plus grande part de la
// largeur disponible.
function pourcentageInfobulle(pourcentageBrut: number): number {
  return Math.min(85, Math.max(15, pourcentageBrut));
}

/**
 * Graphique d'évolution CA + marge brute. Deux séries monétaires sur un seul
 * axe (jamais deux axes — voir la compétence "dataviz") ; la marge peut être
 * `null` sur certaines périodes (coût d'achat inconnu) : le tracé se coupe
 * sur ces trous plutôt que d'interpoler une valeur inventée.
 */
export function GrapheCaMarge({ points, devise }: { points: PointEvolution[]; devise?: string }) {
  const { t } = useLocale();
  const [survol, setSurvol] = useState<number | null>(null);
  const n = points.length;

  const maxBrut = Math.max(0, ...points.map((p) => p.revenue), ...points.map((p) => p.grossMargin ?? 0));
  const maxVal = arrondiEchelle(maxBrut * 1.15 || 1);
  const y = (v: number) => MARGE_HAUT + HAUTEUR_UTILE - (v / maxVal) * HAUTEUR_UTILE;

  const ptsCa = points.map((p, i) => ({ x: x(i, n), y: y(p.revenue) }));
  // La marge se découpe en segments contigus : un point à `null` casse le
  // tracé au lieu d'être relié par une interpolation fictive.
  const segmentsMarge: { x: number; y: number }[][] = [];
  let segmentCourant: { x: number; y: number }[] = [];
  points.forEach((p, i) => {
    if (p.grossMargin == null) {
      if (segmentCourant.length > 0) segmentsMarge.push(segmentCourant);
      segmentCourant = [];
    } else {
      segmentCourant.push({ x: x(i, n), y: y(p.grossMargin) });
    }
  });
  if (segmentCourant.length > 0) segmentsMarge.push(segmentCourant);

  const pas = pasEtiquettes(n);
  const actif = survol != null ? points[survol] : null;

  return (
    <div>
      <div className={styles.grapheLegende}>
        <span className={styles.legendeItem}>
          <span className={styles.legendePuce} style={{ background: "var(--graphique-ca)" }} />
          {t("tdbevo_legendeCa")}
        </span>
        <span className={styles.legendeItem}>
          <span className={styles.legendePuce} style={{ background: "var(--graphique-marge)" }} />
          {t("tdbevo_legendeMarge")}
        </span>
      </div>
      {/* La légende reste HORS de ce conteneur relatif : l'infobulle ci-dessous
          se positionne par rapport à lui, pas à la légende — sinon, près du
          haut du graphique, elle recouvrirait le texte de la légende au lieu
          de rester dans la zone du graphique. */}
      <div className={styles.grapheWrapper}>
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className={styles.graphe}
        onMouseMove={(e) => setSurvol(indexAuSurvol(e, n))}
        onMouseLeave={() => setSurvol(null)}
        role="img"
        aria-label={t("tdbevo_graphCaTitre")}
      >
        {graduations(maxVal).map((v, i) => (
          <g key={i}>
            <line
              x1={MARGE_GAUCHE}
              x2={LARGEUR - MARGE_DROITE}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={MARGE_GAUCHE - 6} y={y(v) + 3} fontSize={9} textAnchor="end" fill="var(--color-texte-muted)">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % pas === 0 || i === n - 1 ? (
            <text
              key={i}
              x={x(i, n)}
              y={HAUTEUR - 6}
              fontSize={9}
              textAnchor="middle"
              fill="var(--color-texte-muted)"
            >
              {p.label}
            </text>
          ) : null,
        )}

        {segmentsMarge.map((seg, idx) => (
          <path
            key={idx}
            d={seg.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ")}
            fill="none"
            stroke="var(--graphique-marge)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={ptsCa.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ")}
          fill="none"
          stroke="var(--graphique-ca)"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {survol != null && (
          <line
            x1={x(survol, n)}
            x2={x(survol, n)}
            y1={MARGE_HAUT}
            y2={HAUTEUR - MARGE_BAS}
            stroke="var(--color-ink)"
            strokeWidth={1}
            strokeDasharray="3,3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {ptsCa.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={survol === i ? 4 : 2.5}
            fill="var(--graphique-ca)"
            stroke="var(--color-surface)"
            strokeWidth={survol === i ? 1.5 : 0}
          />
        ))}
        {points.map((p, i) =>
          p.grossMargin != null ? (
            <circle
              key={i}
              cx={x(i, n)}
              cy={y(p.grossMargin)}
              r={survol === i ? 4 : 2.5}
              fill="var(--graphique-marge)"
              stroke="var(--color-surface)"
              strokeWidth={survol === i ? 1.5 : 0}
            />
          ) : null,
        )}
      </svg>

      {actif && (
        <div
          className={styles.infobulle}
          style={{ left: `${pourcentageInfobulle((x(survol!, n) / LARGEUR) * 100)}%` }}
        >
          <div className={styles.infobulleLabel}>{actif.label}</div>
          <div>
            <span className={styles.legendePuce} style={{ background: "var(--graphique-ca)" }} />
            {t("tdbevo_legendeCa")} : {formatMoney(actif.revenue, devise)}
          </div>
          <div>
            <span className={styles.legendePuce} style={{ background: "var(--graphique-marge)" }} />
            {t("tdbevo_legendeMarge")} :{" "}
            {actif.grossMargin != null ? formatMoney(actif.grossMargin, devise) : "—"}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

/**
 * Graphique d'évolution du nombre de ventes (barres). Unité différente
 * (comptage, pas une devise) : c'est pourquoi c'est un graphique séparé
 * plutôt qu'un second axe sur le graphique CA/marge ci-dessus.
 */
export function GrapheVentes({ points }: { points: PointEvolution[] }) {
  const { t } = useLocale();
  const [survol, setSurvol] = useState<number | null>(null);
  const n = points.length;

  const maxBrut = Math.max(0, ...points.map((p) => p.salesCount));
  const maxVal = arrondiEchelle(maxBrut * 1.15 || 1);
  const y = (v: number) => MARGE_HAUT + HAUTEUR_UTILE - (v / maxVal) * HAUTEUR_UTILE;

  const largeurBande = n > 0 ? LARGEUR_UTILE / n : LARGEUR_UTILE;
  const largeurBarre = Math.min(largeurBande * 0.6, 28);
  const pas = pasEtiquettes(n);
  const actif = survol != null ? points[survol] : null;
  const xBande = (i: number) => MARGE_GAUCHE + i * largeurBande + largeurBande / 2;

  return (
    <div className={styles.grapheWrapper}>
      <svg
        viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
        className={styles.graphe}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const xViewBox = ratio * LARGEUR;
          const i = Math.min(n - 1, Math.max(0, Math.floor((xViewBox - MARGE_GAUCHE) / largeurBande)));
          setSurvol(i);
        }}
        onMouseLeave={() => setSurvol(null)}
        role="img"
        aria-label={t("tdbevo_graphVentesTitre")}
      >
        {graduations(maxVal).map((v, i) => (
          <g key={i}>
            <line
              x1={MARGE_GAUCHE}
              x2={LARGEUR - MARGE_DROITE}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
            <text x={MARGE_GAUCHE - 6} y={y(v) + 3} fontSize={9} textAnchor="end" fill="var(--color-texte-muted)">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {points.map((p, i) => {
          const hauteurBarre = (p.salesCount / maxVal) * HAUTEUR_UTILE;
          return (
            <rect
              key={i}
              x={xBande(i) - largeurBarre / 2}
              y={MARGE_HAUT + HAUTEUR_UTILE - hauteurBarre}
              width={largeurBarre}
              height={Math.max(hauteurBarre, p.salesCount > 0 ? 1 : 0)}
              fill="var(--color-flamme)"
              opacity={survol === i ? 1 : 0.85}
            />
          );
        })}

        {points.map((p, i) =>
          i % pas === 0 || i === n - 1 ? (
            <text
              key={i}
              x={xBande(i)}
              y={HAUTEUR - 6}
              fontSize={9}
              textAnchor="middle"
              fill="var(--color-texte-muted)"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>

      {actif && (
        <div
          className={styles.infobulle}
          style={{ left: `${pourcentageInfobulle((xBande(survol!) / LARGEUR) * 100)}%` }}
        >
          <div className={styles.infobulleLabel}>{actif.label}</div>
          <div>{actif.salesCount} {t("tdbevo_colVentes").toLowerCase()}</div>
        </div>
      )}
    </div>
  );
}

export function TableauEvolution({ points, devise }: { points: PointEvolution[]; devise?: string }) {
  const { t } = useLocale();
  return (
    <table className={styles.tableauEvolution}>
      <thead>
        <tr>
          <th>{t("tdbevo_colPeriode")}</th>
          <th style={{ textAlign: "right" }}>{t("tdbevo_colVentes")}</th>
          <th style={{ textAlign: "right" }}>{t("tdbevo_colCa")}</th>
          <th style={{ textAlign: "right" }}>{t("tdbevo_colMarge")}</th>
          <th style={{ textAlign: "right" }}>{t("tdbevo_colPanier")}</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.periode}>
            <td>{p.label}</td>
            <td style={{ textAlign: "right" }}>{p.salesCount}</td>
            <td style={{ textAlign: "right" }}>{formatMoney(p.revenue, devise)}</td>
            <td style={{ textAlign: "right" }}>
              {p.grossMargin != null ? formatMoney(p.grossMargin, devise) : "—"}
            </td>
            <td style={{ textAlign: "right" }}>{formatMoney(p.panierMoyen, devise)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
