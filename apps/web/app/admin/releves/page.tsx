"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { telechargerFichier } from "../../lib/telecharger-fichier";
import { ouvrirDocumentPdf } from "../../lib/pdf";
import styles from "./page.module.css";

interface CelluleReleve {
  montantUSD: number;
  montantCDF: number;
  quantite: number;
  ventesCount: number;
}

interface ReleveActivite {
  shopId: string | null;
  shopName: string | null;
  from: string;
  to: string;
  granularite: string;
  regroupement: string | null;
  periodes: { cle: string; label: string }[];
  groupes: string[];
  cellules: Record<string, Record<string, CelluleReleve>>;
  totauxParPeriode: Record<string, CelluleReleve>;
  totauxParGroupe: Record<string, CelluleReleve>;
  totalGeneral: CelluleReleve & { ventesCount: number };
  genereLe: string;
  codeCertification: string;
}

interface BoutiqueOption {
  id: string;
  name: string;
}

const GRANULARITES = [
  { valeur: "JOUR", label: "Journalier" },
  { valeur: "SEMAINE", label: "Hebdomadaire" },
  { valeur: "MOIS", label: "Mensuel" },
  { valeur: "ANNEE", label: "Annuel" },
];

function formaterCellule(c: CelluleReleve): string {
  const parts: string[] = [];
  if (c.montantUSD) parts.push(`$${c.montantUSD.toFixed(2)}`);
  if (c.montantCDF) parts.push(`${Math.round(c.montantCDF).toLocaleString("fr-FR")} FC`);
  return parts.length ? parts.join(" + ") : "—";
}

function ilYA(jours: number): string {
  const d = new Date();
  d.setDate(d.getDate() - jours);
  return d.toISOString().slice(0, 10);
}

function AdminRelevesContent() {
  const [boutiques, setBoutiques] = useState<BoutiqueOption[]>([]);
  const [shopId, setShopId] = useState(""); // "" = plateforme entière
  const [from, setFrom] = useState(ilYA(30));
  const [to, setTo] = useState(ilYA(0));
  const [granularite, setGranularite] = useState("JOUR");
  const [regroupement, setRegroupement] = useState("");
  const [releve, setReleve] = useState<ReleveActivite | null>(null);
  const [chargement, setChargement] = useState(false);
  const [exportEnCours, setExportEnCours] = useState<"xlsx" | "pdf" | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ id: string; name: string }[]>("/admin/shops")
      .then((shops) => setBoutiques(shops.map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => {
        // Non bloquant : le relevé plateforme entière reste disponible.
      });
  }, []);

  const regroupements = [
    { valeur: "", label: "Aucun (totaux seulement)" },
    { valeur: "PRODUIT", label: "Par produit" },
    { valeur: "CATEGORIE", label: "Par catégorie" },
    { valeur: "MOYEN_PAIEMENT", label: "Par moyen de paiement" },
    ...(shopId ? [] : [{ valeur: "BOUTIQUE", label: "Par boutique" }]),
  ];

  function construireQuery() {
    const params = new URLSearchParams({
      from: new Date(from).toISOString(),
      to: new Date(new Date(to).getTime() + 86_400_000).toISOString(),
      granularite,
    });
    if (shopId) params.set("shopId", shopId);
    if (regroupement) params.set("regroupement", regroupement);
    return params;
  }

  async function genererApercu() {
    setChargement(true);
    setErreur(null);
    try {
      const data = await api.get<ReleveActivite>(`/admin/reports/releve?${construireQuery().toString()}`);
      setReleve(data);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Le relevé n'a pas pu être généré.");
    } finally {
      setChargement(false);
    }
  }

  async function exporter(format: "xlsx" | "pdf") {
    setExportEnCours(format);
    setErreur(null);
    try {
      const query = construireQuery();
      query.set("format", format);
      const path = `/admin/reports/releve?${query.toString()}`;
      if (format === "xlsx") {
        await telechargerFichier(path, "releve-activite-eleganz.xlsx");
      } else {
        await ouvrirDocumentPdf(path);
      }
    } catch (err) {
      setErreur(err instanceof Error ? err.message : "Export impossible.");
    } finally {
      setExportEnCours(null);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Relevés d&apos;activité</h1>
      <p className={styles.sousTitre}>
        Relevé certifié par la plateforme pour une boutique précise, ou pour l&apos;ensemble de la
        plateforme (regroupement par boutique disponible dans ce cas) — pour vos propres analyses
        ou pour répondre à la demande d&apos;un vendeur.
      </p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label htmlFor="shopId">Boutique</label>
          <select id="shopId" value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="">Toutes boutiques (plateforme entière)</option>
            {boutiques.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="from">Du</label>
          <input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="to">Au</label>
          <input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label htmlFor="granularite">Fréquence</label>
          <select id="granularite" value={granularite} onChange={(e) => setGranularite(e.target.value)}>
            {GRANULARITES.map((g) => (
              <option key={g.valeur} value={g.valeur}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.champ}>
          <label htmlFor="regroupement">Regroupement</label>
          <select
            id="regroupement"
            value={regroupement}
            onChange={(e) => setRegroupement(e.target.value)}
          >
            {regroupements.map((r) => (
              <option key={r.valeur} value={r.valeur}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} onClick={genererApercu} disabled={chargement}>
          {chargement ? "Génération…" : "Afficher l'aperçu"}
        </button>
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}

      {releve && (
        <>
          <div className={styles.actionsExport}>
            <button className={styles.boutonSecondaire} onClick={() => exporter("xlsx")} disabled={exportEnCours !== null}>
              {exportEnCours === "xlsx" ? "…" : "Exporter en Excel"}
            </button>
            <button className={styles.boutonSecondaire} onClick={() => exporter("pdf")} disabled={exportEnCours !== null}>
              {exportEnCours === "pdf" ? "…" : "Exporter en PDF"}
            </button>
          </div>

          <div className={styles.tableauScroll}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{regroupement ? regroupements.find((r) => r.valeur === regroupement)?.label : "Total"}</th>
                  {releve.periodes.map((p) => (
                    <th key={p.cle} className={styles.colChiffre}>
                      {p.label}
                    </th>
                  ))}
                  <th className={styles.colChiffre}>Total</th>
                </tr>
              </thead>
              <tbody>
                {releve.groupes.map((groupe) => (
                  <tr key={groupe}>
                    <td>{groupe}</td>
                    {releve.periodes.map((p) => (
                      <td key={p.cle} className={styles.colChiffre}>
                        {formaterCellule(releve.cellules[groupe][p.cle])}
                      </td>
                    ))}
                    <td className={styles.colChiffre}>
                      <strong>{formaterCellule(releve.totauxParGroupe[groupe])}</strong>
                    </td>
                  </tr>
                ))}
                <tr className={styles.ligneTotal}>
                  <td>TOTAL GÉNÉRAL</td>
                  {releve.periodes.map((p) => (
                    <td key={p.cle} className={styles.colChiffre}>
                      {formaterCellule(releve.totauxParPeriode[p.cle])}
                    </td>
                  ))}
                  <td className={styles.colChiffre}>{formaterCellule(releve.totalGeneral)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={styles.certification}>
            Généré le{" "}
            {new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(
              new Date(releve.genereLe),
            )}
            . Code de vérification : <strong>{releve.codeCertification}</strong> —{" "}
            {releve.totalGeneral.ventesCount} vente(s)/commande(s) incluse(s).
          </p>
        </>
      )}
    </div>
  );
}

export default function AdminRelevesPage() {
  return (
    <AdminShell>
      <AdminRelevesContent />
    </AdminShell>
  );
}
