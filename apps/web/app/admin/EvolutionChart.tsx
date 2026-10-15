"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./EvolutionChart.module.css";

interface EvolutionChartProps {
  titre: string;
  jours: string[]; // "AAAA-MM-JJ"
  valeurs: number[];
  couleur: string;
  formater?: (n: number) => string;
  style?: "ligne" | "barres";
}

const LARGEUR = 600;
const HAUTEUR = 160;
const MARGE_HAUT = 16;
const MARGE_BAS = 24;
const MARGE_COTE = 8;

function formaterJourCourt(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(d);
}

/**
 * Graphique d'évolution en ligne, une seule série — pas de légende requise
 * (le titre nomme la série), survol avec repère + infobulle, trait animé au
 * premier affichage. Construit à la main en SVG inline plutôt qu'avec une
 * librairie : une seule série simple ne justifie pas une dépendance de
 * graphiques entière.
 */
export function EvolutionChart({
  titre,
  jours,
  valeurs,
  couleur,
  formater = (n) => n.toLocaleString("fr-FR"),
  style = "ligne",
}: EvolutionChartProps) {
  const { t } = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const [survol, setSurvol] = useState<number | null>(null);

  const { points, max, total } = useMemo(() => {
    const max = Math.max(1, ...valeurs);
    const zoneHauteur = HAUTEUR - MARGE_HAUT - MARGE_BAS;
    const zoneLargeur = LARGEUR - MARGE_COTE * 2;
    const pas = valeurs.length > 1 ? zoneLargeur / (valeurs.length - 1) : 0;
    const points = valeurs.map((v, i) => ({
      x: MARGE_COTE + pas * i,
      y: MARGE_HAUT + zoneHauteur * (1 - v / max),
      v,
    }));
    const total = valeurs.reduce((s, v) => s + v, 0);
    return { points, max, total };
  }, [valeurs]);

  const cheminLigne = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const cheminAire = `${cheminLigne} L${points[points.length - 1]?.x ?? 0},${HAUTEUR - MARGE_BAS} L${points[0]?.x ?? 0},${HAUTEUR - MARGE_BAS} Z`;

  function surMouvement(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const xRelatif = ((e.clientX - rect.left) / rect.width) * LARGEUR;
    let plusProche = 0;
    let distance = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.x - xRelatif);
      if (d < distance) {
        distance = d;
        plusProche = i;
      }
    });
    setSurvol(plusProche);
  }

  const dernierPoint = points[points.length - 1];
  const pointSurvol = survol !== null ? points[survol] : null;

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <span className={styles.titre}>{titre}</span>
        <span className={styles.total}>{formater(total)}</span>
      </div>
      <div className={styles.zoneGraphique}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${LARGEUR} ${HAUTEUR}`}
          preserveAspectRatio="none"
          className={styles.svg}
          onMouseMove={surMouvement}
          onMouseLeave={() => setSurvol(null)}
          role="img"
          aria-label={t("admgraph_ariaResume")
            .replace("{{titre}}", titre)
            .replace("{{total}}", formater(total))
            .replace("{{jours}}", String(valeurs.length))}
        >
          {[0, 0.5, 1].map((frac) => {
            const y = MARGE_HAUT + (HAUTEUR - MARGE_HAUT - MARGE_BAS) * frac;
            return (
              <line
                key={frac}
                x1={MARGE_COTE}
                y1={y}
                x2={LARGEUR - MARGE_COTE}
                y2={y}
                className={styles.grille}
              />
            );
          })}

          {style === "barres"
            ? points.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - Math.min(10, (LARGEUR - MARGE_COTE * 2) / valeurs.length / 2.4)}
                  y={p.y}
                  width={Math.min(20, (LARGEUR - MARGE_COTE * 2) / valeurs.length / 1.2)}
                  height={Math.max(0, HAUTEUR - MARGE_BAS - p.y)}
                  fill={couleur}
                  opacity={survol === null || survol === i ? 1 : 0.45}
                />
              ))
            : (
              <>
                <path d={cheminAire} fill={couleur} opacity={0.1} stroke="none" />
                <path
                  d={cheminLigne}
                  fill="none"
                  stroke={couleur}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  className={styles.traceLigne}
                />
              </>
            )}

          {dernierPoint && style === "ligne" && (
            <circle
              cx={dernierPoint.x}
              cy={dernierPoint.y}
              r={5}
              fill={couleur}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          )}

          {pointSurvol && (
            <>
              <line
                x1={pointSurvol.x}
                y1={MARGE_HAUT}
                x2={pointSurvol.x}
                y2={HAUTEUR - MARGE_BAS}
                className={styles.reperesurvol}
              />
              <circle
                cx={pointSurvol.x}
                cy={pointSurvol.y}
                r={5}
                fill={couleur}
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
            </>
          )}
        </svg>

        {pointSurvol && survol !== null && (
          <div
            className={styles.infobulle}
            style={{ left: `${(pointSurvol.x / LARGEUR) * 100}%` }}
          >
            <div className={styles.infobulleJour}>{formaterJourCourt(jours[survol])}</div>
            <div className={styles.infobulleValeur}>{formater(valeurs[survol])}</div>
          </div>
        )}
      </div>
      <div className={styles.axe}>
        <span>{formaterJourCourt(jours[0])}</span>
        <span>{formaterJourCourt(jours[jours.length - 1])}</span>
      </div>
    </div>
  );
}
