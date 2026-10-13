"use client";

import { useEffect, useState } from "react";
import { ComptableShell } from "../ComptableShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney } from "../../lib/money";
import styles from "./page.module.css";

interface Periode {
  ventesCdf: number;
  ventesUsd: number;
  depensesCdf: number;
  depensesUsd: number;
}

interface Dashboard {
  activites: number;
  jour: Periode;
  semaine: Periode;
  mois: Periode;
  annee: Periode;
  dettesRestantes: Record<string, number>;
  creancesRestantes: Record<string, number>;
  nombreDettesEnCours: number;
  nombreCreancesEnCours: number;
}

function CartePeriode({ titre, periode }: { titre: string; periode: Periode }) {
  const soldeCdf = periode.ventesCdf - periode.depensesCdf;
  const soldeUsd = periode.ventesUsd - periode.depensesUsd;
  return (
    <div className={styles.cartePeriode}>
      <div className={styles.cartePeriodeTitre}>{titre}</div>
      <div className={styles.cartePeriodeLigne}>
        <span>Ventes CDF</span>
        <span>{formatMoney(periode.ventesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Dépenses CDF</span>
        <span>{formatMoney(periode.depensesCdf, "CDF")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Résultat estimé CDF</span>
        <span className={soldeCdf >= 0 ? styles.soldePositif : styles.soldeNegatif}>
          {formatMoney(soldeCdf, "CDF")}
        </span>
      </div>
      <hr style={{ margin: "12px 0", border: "none", borderTop: "1px solid var(--color-border)" }} />
      <div className={styles.cartePeriodeLigne}>
        <span>Ventes USD</span>
        <span>{formatMoney(periode.ventesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Dépenses USD</span>
        <span>{formatMoney(periode.depensesUsd, "USD")}</span>
      </div>
      <div className={styles.cartePeriodeLigne}>
        <span>Résultat estimé USD</span>
        <span className={soldeUsd >= 0 ? styles.soldePositif : styles.soldeNegatif}>
          {formatMoney(soldeUsd, "USD")}
        </span>
      </div>
    </div>
  );
}

function ChiffresContenu() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Dashboard>("/comptable/dashboard")
      .then(setDashboard)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <p>Chargement…</p>;
  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (!dashboard) return null;

  return (
    <div>
      <h1 className={styles.titre}>Mon activité en chiffres</h1>
      <p className={styles.sousTitre}>
        Calculé à partir des {dashboard.activites} activité(s) enregistrée(s) — jamais une donnée inventée.
      </p>

      <div className={styles.grillePeriodes}>
        <CartePeriode titre="Aujourd'hui" periode={dashboard.jour} />
        <CartePeriode titre="Cette semaine" periode={dashboard.semaine} />
        <CartePeriode titre="Ce mois-ci" periode={dashboard.mois} />
        <CartePeriode titre="Cette année" periode={dashboard.annee} />
      </div>

      <h2 className={styles.sectionTitre}>Dettes, créances et emprunts en cours</h2>
      <div className={styles.grillePeriodes}>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>Dettes ({dashboard.nombreDettesEnCours})</div>
          {Object.entries(dashboard.dettesRestantes).length === 0 ? (
            <p>Aucune dette en cours.</p>
          ) : (
            Object.entries(dashboard.dettesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>Solde restant</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
        <div className={styles.cartePeriode}>
          <div className={styles.cartePeriodeTitre}>Créances ({dashboard.nombreCreancesEnCours})</div>
          {Object.entries(dashboard.creancesRestantes).length === 0 ? (
            <p>Aucune créance en cours.</p>
          ) : (
            Object.entries(dashboard.creancesRestantes).map(([devise, montant]) => (
              <div className={styles.cartePeriodeLigne} key={devise}>
                <span>Solde restant</span>
                <span>{formatMoney(montant, devise)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className={styles.note}>
        Ces chiffres sont calculés à partir de vos saisies déclaratives. Ils ne constituent pas un état
        financier certifié ni un relevé bancaire officiel.
      </p>
    </div>
  );
}

export default function ComptableChiffresPage() {
  return (
    <ComptableShell>
      <ChiffresContenu />
    </ComptableShell>
  );
}
