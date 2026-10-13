"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { api, ApiError } from "../../../lib/api";
import styles from "./page.module.css";

// Règles fiscales applicables à ELEGANZ (prompt du 13 oct. 2026, §14) —
// scope=PLATFORM, strictement indépendant des règles fiscales de chaque
// boutique (scope=SHOP) : cette page n'appelle jamais une route boutique,
// et les routes /admin/finance/fiscal-rules ne retournent jamais de règle
// de boutique (séparation imposée côté API — voir
// docs/ARCHITECTURE_FINANCE.md §3.2).

interface RegleFiscale {
  id: string;
  label: string;
  category: "TVA" | "IMPOT" | "RETENUE" | "CONTRIBUTION" | "AUTRE";
  rateOrFormula: string;
  effectiveFrom: string;
  status: "PROPOSEE" | "CONFIGUREE" | "VERIFIEE" | "OBSOLETE";
}

const LABELS_STATUT: Record<RegleFiscale["status"], string> = {
  PROPOSEE: "Proposée",
  CONFIGUREE: "Configurée",
  VERIFIEE: "Vérifiée",
  OBSOLETE: "Obsolète",
};

function ReglesFiscalesAdminContenu() {
  const [regles, setRegles] = useState<RegleFiscale[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<RegleFiscale["category"]>("TVA");
  const [rateOrFormula, setRateOrFormula] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [motif, setMotif] = useState("");
  const [enCours, setEnCours] = useState(false);

  function recharger() {
    setChargement(true);
    api
      .get<RegleFiscale[]>("/admin/finance/fiscal-rules")
      .then(setRegles)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    if (!label || !rateOrFormula || !motif) return;
    setEnCours(true);
    setErreur(null);
    setMessage(null);
    try {
      await api.post("/admin/finance/fiscal-rules", {
        label,
        category,
        rateOrFormula,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        motif,
      });
      setLabel("");
      setRateOrFormula("");
      setMotif("");
      setMessage("Règle fiscale ELEGANZ enregistrée.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Règles fiscales applicables à ELEGANZ</h1>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>
        Profil fiscal propre à la société exploitante ELEGANZ — totalement
        indépendant des règles fiscales de chaque boutique. Aucune
        modification ici ne touche une boutique, et réciproquement.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {message && <div className={styles.message}>{message}</div>}

      {chargement ? (
        <p>Chargement…</p>
      ) : (
        <>
          <form onSubmit={creer} style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
            <input placeholder="Intitulé" value={label} onChange={(e) => setLabel(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <select value={category} onChange={(e) => setCategory(e.target.value as RegleFiscale["category"])} style={{ minHeight: 40 }}>
              <option value="TVA">TVA</option>
              <option value="IMPOT">Impôt</option>
              <option value="RETENUE">Retenue</option>
              <option value="CONTRIBUTION">Contribution</option>
              <option value="AUTRE">Autre</option>
            </select>
            <input placeholder="Taux ou formule" value={rateOrFormula} onChange={(e) => setRateOrFormula(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <input placeholder="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
            <button className={styles.boutonVerif} type="submit" disabled={enCours || !label || !rateOrFormula || !motif}>
              {enCours ? "Enregistrement…" : "Ajouter"}
            </button>
          </form>

          {regles.length === 0 ? (
            <p>Aucune règle fiscale ELEGANZ enregistrée pour l&apos;instant.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Intitulé</th>
                  <th style={{ textAlign: "left" }}>Catégorie</th>
                  <th style={{ textAlign: "left" }}>Taux / formule</th>
                  <th style={{ textAlign: "left" }}>Depuis</th>
                  <th style={{ textAlign: "left" }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {regles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td>{r.category}</td>
                    <td>{r.rateOrFormula}</td>
                    <td>{new Date(r.effectiveFrom).toLocaleDateString("fr-FR")}</td>
                    <td>{LABELS_STATUT[r.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}

export default function ReglesFiscalesAdminPage() {
  return (
    <AdminShell>
      <ReglesFiscalesAdminContenu />
    </AdminShell>
  );
}
