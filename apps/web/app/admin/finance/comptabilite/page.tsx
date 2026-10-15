"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { AdminShell } from "../../AdminShell";
import { api, ApiError } from "../../../lib/api";
import { telechargerFichier } from "../../../lib/telecharger-fichier";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Miroir ELEGANZ du moteur comptable (13 oct. 2026, Phase 2 ; grand livre et
// états normalisés SYSCOHADA ajoutés le 15 oct. 2026) — scope PLATFORM
// uniquement, voir docs/ARCHITECTURE_FINANCE.md §8bis.5/§6. Ces routes ne
// prennent jamais de :shopId et ne touchent jamais les écritures d'une
// boutique.
interface LigneEcriture {
  id: string;
  account: { code: string; label: string };
  debit: string;
  credit: string;
}

interface Ecriture {
  id: string;
  entryDate: string;
  label: string;
  journal: { code: string };
  lines: LigneEcriture[];
}

interface MouvementGrandLivre {
  date: string;
  label: string;
  sourceType: string;
  debit: number;
  credit: number;
  soldeCumule: number;
}

interface GrandLivre {
  compte: string;
  mouvements: MouvementGrandLivre[];
  soldeFinal: number;
}

interface LigneBalance {
  code: string;
  label: string;
  debit: number;
  credit: number;
  solde: number;
}

interface Balance {
  comptes: LigneBalance[];
  totalDebit: number;
  totalCredit: number;
  equilibree: boolean;
}

interface LigneEtat {
  code: string;
  label: string;
  montant: number;
}

interface CompteDeResultat {
  charges: LigneEtat[];
  produits: LigneEtat[];
  totalCharges: number;
  totalProduits: number;
  resultatNet: number;
}

interface Bilan {
  actif: LigneEtat[];
  passif: LigneEtat[];
  totalActif: number;
  totalPassif: number;
  equilibre: boolean;
}

// États normalisés SYSCOHADA — ELEGANZ elle-même (chantier réactivé, phase 6,
// 14 oct. 2026) : regroupement réglementaire par rubrique. Toujours une
// estimation de pilotage, jamais une liasse certifiée — voir le bandeau
// d'avertissement affiché sous chaque tableau normalisé.
interface BilanNormalise {
  actif: { immobilise: LigneEtat[]; circulant: LigneEtat[]; tresorerie: LigneEtat[] };
  passif: { capitauxPropres: LigneEtat[]; dettesFinancieres: LigneEtat[]; circulant: LigneEtat[] };
  totalActif: number;
  totalPassif: number;
  equilibre: boolean;
}

interface CompteDeResultatNormalise {
  exploitation: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  financier: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  resultatActivitesOrdinaires: number;
  hao: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  resultatNetAvantImpot: number;
  statut: string;
}

const tableStyle: CSSProperties = { width: "100%", borderCollapse: "collapse" };

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

function ComptabiliteAdminContenu() {
  const { t } = useLocale();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [vue, setVue] = useState<
    "journal" | "grand-livre" | "balance" | "compte-resultat" | "bilan" | "bilan-normalise" | "compte-resultat-normalise"
  >("journal");

  const [journal, setJournal] = useState<Ecriture[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [compteChoisi, setCompteChoisi] = useState("5711");
  const [grandLivre, setGrandLivre] = useState<GrandLivre | null>(null);
  const [compteResultat, setCompteResultat] = useState<CompteDeResultat | null>(null);
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [bilanNormalise, setBilanNormalise] = useState<BilanNormalise | null>(null);
  const [compteResultatNormalise, setCompteResultatNormalise] = useState<CompteDeResultatNormalise | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  async function telechargerDossierValidation() {
    setExportEnCours(true);
    setErreur(null);
    try {
      // Dossier de validation externe SYSCOHADA — ELEGANZ elle-même
      // (chantier réactivé, phase 7, 14 oct. 2026). Même borne de date que
      // le reste de la page (du/au ci-dessus, bornée exclusive côté API).
      const toExclusif = new Date(to);
      toExclusif.setDate(toExclusif.getDate() + 1);
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", toExclusif.toISOString().slice(0, 10));
      await telechargerFichier(
        `/admin/finance/dossier-validation?${params.toString()}`,
        "dossier-validation-syscohada-eleganz.xlsx",
      );
    } catch (err) {
      setErreur(err instanceof Error ? err.message : t("cpt_dossierNonGenere"));
    } finally {
      setExportEnCours(false);
    }
  }

  useEffect(() => {
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    const toExclusifStr = toExclusif.toISOString().slice(0, 10);
    const params = `from=${from}&to=${toExclusifStr}`;

    const requete =
      vue === "journal"
        ? api.get<Ecriture[]>(`/admin/finance/journal?${params}`).then(setJournal)
        : vue === "balance"
        ? api.get<Balance>(`/admin/finance/balance?${params}`).then(setBalance)
        : vue === "grand-livre"
        ? api
            .get<GrandLivre>(`/admin/finance/grand-livre?compte=${compteChoisi}&${params}`)
            .then(setGrandLivre)
        : vue === "compte-resultat"
        ? api.get<CompteDeResultat>(`/admin/finance/compte-resultat?${params}`).then(setCompteResultat)
        : vue === "compte-resultat-normalise"
        ? api
            .get<CompteDeResultatNormalise>(`/admin/finance/compte-resultat-normalise?${params}`)
            .then(setCompteResultatNormalise)
        : vue === "bilan"
        ? api.get<Bilan>(`/admin/finance/bilan?asOf=${toExclusifStr}`).then(setBilan)
        : api.get<BilanNormalise>(`/admin/finance/bilan-normalise?asOf=${toExclusifStr}`).then(setBilanNormalise);

    requete
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }, [vue, from, to, compteChoisi, t]);

  return (
    <div>
      <h1 className={styles.titre}>{t("admfinct_titre")}</h1>
      <p style={{ marginBottom: "16px" }}>
        <Link href="/admin/finance">{t("admfinct_lienTableauBord")}</Link>
      </p>
      <p style={{ color: "var(--color-texte-muted)", marginBottom: "16px" }}>{t("admfinct_description")}</p>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>
          {t("rel_du")}{" "}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
        <label>
          {t("rel_au")}{" "}
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ minHeight: 40, padding: 6 }} />
        </label>
        <label>
          {t("cpt_vue")}{" "}
          <select
            value={vue}
            onChange={(e) => setVue(e.target.value as typeof vue)}
            style={{ minHeight: 40, padding: 6 }}
          >
            <option value="journal">{t("cpt_journalGeneral")}</option>
            <option value="grand-livre">{t("cpt_grandLivre")}</option>
            <option value="balance">{t("cpt_balance")}</option>
            <option value="compte-resultat">{t("cpt_compteDeResultat")}</option>
            <option value="bilan">{t("cpt_bilan")}</option>
            <option value="bilan-normalise">{t("cpt_bilanNormaliseSyscohada")}</option>
            <option value="compte-resultat-normalise">{t("cpt_compteDeResultatNormaliseSyscohada")}</option>
          </select>
        </label>
        {vue === "grand-livre" && (
          <label>
            {t("cpt_compte")}{" "}
            <select
              value={compteChoisi}
              onChange={(e) => setCompteChoisi(e.target.value)}
              style={{ minHeight: 40, padding: 6 }}
            >
              <option value="5711">5711 — {t("cpt_compteCaisseUsd")}</option>
              <option value="5712">5712 — {t("cpt_compteCaisseCdf")}</option>
              <option value="411">411 — {t("cpt_compteClients")}</option>
              <option value="401">401 — {t("cpt_compteFournisseurs")}</option>
              <option value="601">601 — {t("cpt_compteAchatsMarchandises")}</option>
              <option value="6220">6220 — {t("cpt_compteChargesFonctionnement")}</option>
              <option value="6221">6221 — {t("cpt_compteChargesAdministratives")}</option>
              <option value="6222">6222 — {t("cpt_compteChargesCommerciales")}</option>
              <option value="661">661 — {t("cpt_compteChargesPersonnel")}</option>
              <option value="641">641 — {t("cpt_compteImpotsTaxes")}</option>
              <option value="671">671 — {t("cpt_compteChargesFinancieres")}</option>
              <option value="701">701 — {t("cpt_compteVentesMarchandises")}</option>
              <option value="7012">7012 — {t("cpt_compteVentesMarketplace")}</option>
            </select>
          </label>
        )}
      </div>

      {(vue === "bilan-normalise" || vue === "compte-resultat-normalise") && (
        <div style={{ marginBottom: "16px" }}>
          <button className={styles.boutonVerif} onClick={telechargerDossierValidation} disabled={exportEnCours}>
            {exportEnCours ? t("cpt_generationEnCours") : t("cpt_telechargerDossierValidation")}
          </button>
          <p style={{ color: "var(--color-texte-muted)", fontSize: "0.75rem", marginTop: "6px" }}>
            {t("cpt_noteDossierValidation")}
          </p>
        </div>
      )}

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : vue === "journal" ? (
        <JournalTable ecritures={journal} />
      ) : vue === "grand-livre" ? (
        <GrandLivreTable data={grandLivre} />
      ) : vue === "balance" ? (
        <BalanceTable data={balance} />
      ) : vue === "compte-resultat" ? (
        <CompteDeResultatTable data={compteResultat} />
      ) : vue === "bilan" ? (
        <BilanTable data={bilan} />
      ) : vue === "bilan-normalise" ? (
        <BilanNormaliseTable data={bilanNormalise} />
      ) : (
        <CompteDeResultatNormaliseTable data={compteResultatNormalise} />
      )}
    </div>
  );
}

function JournalTable({ ecritures }: { ecritures: Ecriture[] | null }) {
  const { t } = useLocale();
  if (!ecritures) return <p>{t("cpt_aucuneDonnee")}</p>;
  if (ecritures.length === 0) return <p>{t("cpt_aucuneEcriturePeriode")}</p>;
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
          <th style={{ textAlign: "left" }}>{t("tre_colLibelle")}</th>
          <th style={{ textAlign: "left" }}>{t("cpt_compte")}</th>
          <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
          <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
        </tr>
      </thead>
      <tbody>
        {ecritures.map((e) =>
          e.lines.map((l, i) => (
            <tr key={l.id}>
              {i === 0 ? (
                <>
                  <td rowSpan={e.lines.length}>{new Date(e.entryDate).toLocaleDateString("fr-FR")}</td>
                  <td rowSpan={e.lines.length}>{e.label}</td>
                </>
              ) : null}
              <td>
                {l.account.code} — {l.account.label}
              </td>
              <td style={{ textAlign: "right" }}>{Number(l.debit) > 0 ? `${f(l.debit)} $` : ""}</td>
              <td style={{ textAlign: "right" }}>{Number(l.credit) > 0 ? `${f(l.credit)} $` : ""}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

function GrandLivreTable({ data }: { data: GrandLivre | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  if (data.mouvements.length === 0) return <p>{t("cpt_aucunMouvementComptePeriode")}</p>;
  return (
    <>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
            <th style={{ textAlign: "left" }}>{t("tre_colLibelle")}</th>
            <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
            <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
            <th style={{ textAlign: "right" }}>{t("tre_colSoldeCumule")}</th>
          </tr>
        </thead>
        <tbody>
          {data.mouvements.map((m, i) => (
            <tr key={i}>
              <td>{new Date(m.date).toLocaleDateString("fr-FR")}</td>
              <td>{m.label}</td>
              <td style={{ textAlign: "right" }}>{m.debit > 0 ? `${f(m.debit)} $` : ""}</td>
              <td style={{ textAlign: "right" }}>{m.credit > 0 ? `${f(m.credit)} $` : ""}</td>
              <td style={{ textAlign: "right" }}>{f(m.soldeCumule)} $</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "12px", fontWeight: 700 }}>
        {t("cpt_soldeFinal")} {f(data.soldeFinal)} $
      </p>
      <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>
        {t("cpt_noteConventionSoldeNegatif")}
      </p>
    </>
  );
}

function BalanceTable({ data }: { data: Balance | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  if (data.comptes.length === 0) return <p>{t("cpt_aucunMouvementPeriode")}</p>;
  return (
    <>
      {!data.equilibree && <div className={styles.erreur}>{t("cpt_anomalieBalance")}</div>}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>{t("cpt_compte")}</th>
            <th style={{ textAlign: "right" }}>{t("tre_colDebit")}</th>
            <th style={{ textAlign: "right" }}>{t("tre_colCredit")}</th>
            <th style={{ textAlign: "right" }}>{t("cpt_colSolde")}</th>
          </tr>
        </thead>
        <tbody>
          {data.comptes.map((c) => (
            <tr key={c.code}>
              <td>
                {c.code} — {c.label}
              </td>
              <td style={{ textAlign: "right" }}>{f(c.debit)} $</td>
              <td style={{ textAlign: "right" }}>{f(c.credit)} $</td>
              <td style={{ textAlign: "right" }}>{f(c.solde)} $</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight: 700 }}>
            <td>{t("cpt_total")}</td>
            <td style={{ textAlign: "right" }}>{f(data.totalDebit)} $</td>
            <td style={{ textAlign: "right" }}>{f(data.totalCredit)} $</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

function CompteDeResultatTable({ data }: { data: CompteDeResultat | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  if (data.charges.length === 0 && data.produits.length === 0) {
    return <p>{t("cpt_aucuneChargeProduitPeriode")}</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      <div>
        <h3>{t("cpt_charges")}</h3>
        <table style={tableStyle}>
          <tbody>
            {data.charges.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} — {l.label}
                </td>
                <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>{t("cpt_totalCharges")}</td>
              <td style={{ textAlign: "right" }}>{f(data.totalCharges)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div>
        <h3>{t("cpt_produits")}</h3>
        <table style={tableStyle}>
          <tbody>
            {data.produits.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} — {l.label}
                </td>
                <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>{t("cpt_totalProduits")}</td>
              <td style={{ textAlign: "right" }}>{f(data.totalProduits)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{ gridColumn: "1 / -1", fontWeight: 700 }}>
        {t("cpt_resultatNetPeriode")} {f(data.resultatNet)} $ ({data.resultatNet >= 0 ? t("cpt_benefice") : t("cpt_perte")})
      </p>
    </div>
  );
}

function BilanTable({ data }: { data: Bilan | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  if (data.actif.length === 0 && data.passif.length === 0) {
    return <p>{t("cpt_aucunSoldeDate")}</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      {!data.equilibre && (
        <div className={styles.erreur} style={{ gridColumn: "1 / -1" }}>
          {t("cpt_anomalieBilan")}
        </div>
      )}
      <div>
        <h3>{t("cpt_actif")}</h3>
        <table style={tableStyle}>
          <tbody>
            {data.actif.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} — {l.label}
                </td>
                <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>{t("cpt_totalActif")}</td>
              <td style={{ textAlign: "right" }}>{f(data.totalActif)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div>
        <h3>{t("cpt_passif")}</h3>
        <table style={tableStyle}>
          <tbody>
            {data.passif.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} — {l.label}
                </td>
                <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>{t("cpt_totalPassif")}</td>
              <td style={{ textAlign: "right" }}>{f(data.totalPassif)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function LigneEtatTable({ titre, lignes, total }: { titre: string; lignes: LigneEtat[]; total: number }) {
  const { t } = useLocale();
  return (
    <div>
      <h4 style={{ marginBottom: "6px" }}>{titre}</h4>
      {lignes.length === 0 ? (
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.8rem" }}>{t("cpt_aucunSolde")}</p>
      ) : (
        <table style={tableStyle}>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.code}>
                <td>
                  {l.code} — {l.label}
                </td>
                <td style={{ textAlign: "right" }}>{f(l.montant)} $</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>{t("cpt_sousTotal")}</td>
              <td style={{ textAlign: "right" }}>{f(total)} $</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

function AvertissementSyscohada() {
  const { t } = useLocale();
  return (
    <p style={{ fontSize: "0.75rem", color: "#b08900", marginTop: "16px", lineHeight: 1.5 }}>
      {t("cpt_avertissementSyscohada")}
    </p>
  );
}

function BilanNormaliseTable({ data }: { data: BilanNormalise | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  const totalActifLignes = data.actif.immobilise.length + data.actif.circulant.length + data.actif.tresorerie.length;
  const totalPassifLignes =
    data.passif.capitauxPropres.length + data.passif.dettesFinancieres.length + data.passif.circulant.length;
  if (totalActifLignes === 0 && totalPassifLignes === 0) {
    return <p>{t("cpt_aucunSoldeDate")}</p>;
  }
  const totalActifImmo = data.actif.immobilise.reduce((s, l) => s + l.montant, 0);
  const totalActifCirc = data.actif.circulant.reduce((s, l) => s + l.montant, 0);
  const totalTresorerie = data.actif.tresorerie.reduce((s, l) => s + l.montant, 0);
  const totalCapitaux = data.passif.capitauxPropres.reduce((s, l) => s + l.montant, 0);
  const totalDettesFin = data.passif.dettesFinancieres.reduce((s, l) => s + l.montant, 0);
  const totalPassifCirc = data.passif.circulant.reduce((s, l) => s + l.montant, 0);
  return (
    <div>
      {!data.equilibre && <div className={styles.erreur}>{t("cpt_anomalieBilanNormalise")}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <h3>{t("cpt_actif")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LigneEtatTable titre={t("cpt_actifImmobilise")} lignes={data.actif.immobilise} total={totalActifImmo} />
            <LigneEtatTable titre={t("cpt_actifCirculant")} lignes={data.actif.circulant} total={totalActifCirc} />
            <LigneEtatTable titre={t("cpt_tresorerieActif")} lignes={data.actif.tresorerie} total={totalTresorerie} />
          </div>
          <p style={{ marginTop: "10px", fontWeight: 700 }}>
            {t("cpt_totalActif")} : {f(data.totalActif)} $
          </p>
        </div>
        <div>
          <h3>{t("cpt_passif")}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LigneEtatTable titre={t("cpt_capitauxPropres")} lignes={data.passif.capitauxPropres} total={totalCapitaux} />
            <LigneEtatTable titre={t("cpt_dettesFinancieres")} lignes={data.passif.dettesFinancieres} total={totalDettesFin} />
            <LigneEtatTable titre={t("cpt_passifCirculant")} lignes={data.passif.circulant} total={totalPassifCirc} />
          </div>
          <p style={{ marginTop: "10px", fontWeight: 700 }}>
            {t("cpt_totalPassif")} : {f(data.totalPassif)} $
          </p>
        </div>
      </div>
      <AvertissementSyscohada />
    </div>
  );
}

function CompteDeResultatNormaliseTable({ data }: { data: CompteDeResultatNormalise | null }) {
  const { t } = useLocale();
  if (!data) return <p>{t("cpt_aucuneDonnee")}</p>;
  const vide =
    data.exploitation.produits.length === 0 &&
    data.exploitation.charges.length === 0 &&
    data.financier.produits.length === 0 &&
    data.financier.charges.length === 0 &&
    data.hao.produits.length === 0 &&
    data.hao.charges.length === 0;
  if (vide) return <p>{t("cpt_aucuneChargeProduitPeriode")}</p>;

  const totalProduitsExploitation = data.exploitation.produits.reduce((s, l) => s + l.montant, 0);
  const totalChargesExploitation = data.exploitation.charges.reduce((s, l) => s + l.montant, 0);
  const totalProduitsFinanciers = data.financier.produits.reduce((s, l) => s + l.montant, 0);
  const totalChargesFinancieres = data.financier.charges.reduce((s, l) => s + l.montant, 0);
  const totalProduitsHAO = data.hao.produits.reduce((s, l) => s + l.montant, 0);
  const totalChargesHAO = data.hao.charges.reduce((s, l) => s + l.montant, 0);

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <section>
          <h3>{t("cpt_exploitation")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre={t("cpt_produitsExploitation")} lignes={data.exploitation.produits} total={totalProduitsExploitation} />
            <LigneEtatTable titre={t("cpt_chargesExploitation")} lignes={data.exploitation.charges} total={totalChargesExploitation} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>
            {t("cpt_resultatExploitation")} {f(data.exploitation.resultat)} $
          </p>
        </section>
        <section>
          <h3>{t("cpt_financier")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre={t("cpt_produitsFinanciers")} lignes={data.financier.produits} total={totalProduitsFinanciers} />
            <LigneEtatTable titre={t("cpt_chargesFinancieres")} lignes={data.financier.charges} total={totalChargesFinancieres} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>
            {t("cpt_resultatFinancier")} {f(data.financier.resultat)} $
          </p>
        </section>
        <p style={{ fontWeight: 700 }}>
          {t("cpt_resultatActivitesOrdinaires")} {f(data.resultatActivitesOrdinaires)} $
        </p>
        <section>
          <h3>{t("cpt_horsActivitesOrdinaires")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre={t("cpt_produitsHao")} lignes={data.hao.produits} total={totalProduitsHAO} />
            <LigneEtatTable titre={t("cpt_chargesHao")} lignes={data.hao.charges} total={totalChargesHAO} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>
            {t("cpt_resultatHao")} {f(data.hao.resultat)} $
          </p>
        </section>
      </div>
      <p style={{ marginTop: "16px", fontWeight: 700, fontSize: "1.1rem" }}>
        {t("cpt_resultatNetAvantImpot")} {f(data.resultatNetAvantImpot)} $ (
        {data.resultatNetAvantImpot >= 0 ? t("cpt_benefice") : t("cpt_perte")})
      </p>
      <p style={{ fontSize: "0.8rem", color: "var(--color-texte-muted)", marginTop: "4px" }}>{data.statut}</p>
      <AvertissementSyscohada />
    </div>
  );
}

export default function ComptabiliteAdminPage() {
  return (
    <AdminShell>
      <ComptabiliteAdminContenu />
    </AdminShell>
  );
}
