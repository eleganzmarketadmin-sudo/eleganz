"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { telechargerFichier } from "../../../lib/telecharger-fichier";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Rapport détaillé "Ventes Caisse" (demande du 19 nov. 2026, avec capture
// d'écran du Centre de pilotage : "rendre ces [cartes de revenu] également
// de bouton ... ça nous amène ou ouvre le rapport détaillé"). Sur les 6
// cartes de revenu du pilotage, 4 pointent vers l'écran Factures déjà
// existant ; "Ventes Caisse" et "Commission Institutions" (ici et
// commission-institutions/page.tsx, même gabarit) n'avaient aucun écran de
// détail — l'utilisateur a choisi l'option la plus complète proposée
// ("Rapport complet avec filtres et export"), pas une simple liste.
// Source des lignes : AdminFinanceService.listerVentesCaisse /
// exporterVentesCaisse (GET /admin/finance/ventes-caisse, même agrégat que
// la carte "caisse" du pilotage — PosSale hors statut CANCELLED — mais
// filtrable par période ici, ce que la carte ne permet pas).
interface LigneVenteCaisse {
  id: string;
  boutique: string;
  montant: number;
  devise: string;
  statut: string;
  date: string;
}

interface VentesCaisseReponse {
  periode: { from: string; to: string };
  total: number;
  lignes: LigneVenteCaisse[];
}

function f(n: number | string): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function debutMois(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function VentesCaisseContenu() {
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [donnees, setDonnees] = useState<VentesCaisseReponse | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    api
      .get<VentesCaisseReponse>(
        `/admin/finance/ventes-caisse?from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`,
      )
      .then(setDonnees)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }, [from, to, t]);

  async function exporter() {
    setExportEnCours(true);
    setErreur(null);
    try {
      const toExclusif = new Date(to);
      toExclusif.setDate(toExclusif.getDate() + 1);
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", toExclusif.toISOString().slice(0, 10));
      await telechargerFichier(`/admin/finance/export/ventes-caisse?${params.toString()}`, "ventes-caisse-eleganz.xlsx");
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("fin_erreurGenerique"));
    } finally {
      setExportEnCours(false);
    }
  }

  function libelleStatut(s: string): string {
    if (s === "COMPLETED") return t("admvc_statutCompletee");
    if (s === "RETURNED") return t("admvc_statutRetournee");
    return s;
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admvc_titre")}</h1>
      <AdminFinanceSubNav />

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_du")}</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("rel_au")}</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <button className={styles.bouton} onClick={exporter} disabled={exportEnCours}>
          {exportEnCours ? t("admvc_exportEnCours") : t("admvc_exporter")}
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : !donnees || donnees.lignes.length === 0 ? (
        <p>{t("admvc_aucuneVente")}</p>
      ) : (
        <>
          <div
            style={{
              border: "2px solid var(--color-ink)",
              padding: "16px",
              minWidth: "220px",
              marginBottom: "20px",
              display: "inline-block",
            }}
          >
            <div style={{ fontWeight: 700 }}>{t("admvc_total")}</div>
            <div style={{ fontSize: "1.5rem" }}>{f(donnees.total)}</div>
          </div>

          <div className={styles.tableauScroll}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>{t("admvc_colBoutique")}</th>
                  <th style={{ textAlign: "right" }}>{t("admvc_colMontant")}</th>
                  <th style={{ textAlign: "left" }}>{t("admvc_colDevise")}</th>
                  <th style={{ textAlign: "left" }}>{t("admvc_colStatut")}</th>
                  <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
                </tr>
              </thead>
              <tbody>
                {donnees.lignes.map((l) => (
                  <tr key={l.id}>
                    <td>{l.boutique}</td>
                    <td style={{ textAlign: "right" }}>{f(l.montant)}</td>
                    <td>{l.devise}</td>
                    <td>{libelleStatut(l.statut)}</td>
                    <td>{new Date(l.date).toLocaleDateString("fr-FR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminVentesCaissePage() {
  return (
    <AdminShell>
      <VentesCaisseContenu />
    </AdminShell>
  );
}
