"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Moteur de comptabilité en partie double (13 oct. 2026, Phase 2) — voir
// docs/ARCHITECTURE_FINANCE.md §8bis. Les écritures affichées ici sont
// générées automatiquement par l'API à partir des ventes, charges, achats et
// commandes réellement enregistrées — rien n'est saisi manuellement sur
// cette page à cette phase. Ce n'est ni un bilan ni un compte de résultat :
// seulement le journal, le grand livre et la balance des écritures réelles.
interface LigneEcriture {
  id: string;
  accountId: string;
  account: { code: string; label: string };
  debit: string;
  credit: string;
  label: string | null;
}

interface Ecriture {
  id: string;
  entryDate: string;
  label: string;
  sourceType: string;
  journal: { code: string; label: string };
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
  periode: { from: string; to: string };
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
  periode: { from: string; to: string };
  charges: LigneEtat[];
  produits: LigneEtat[];
  totalCharges: number;
  totalProduits: number;
  resultatNet: number;
}

interface Bilan {
  asOf: string;
  actif: LigneEtat[];
  passif: LigneEtat[];
  totalActif: number;
  totalPassif: number;
  equilibre: boolean;
}

// États normalisés SYSCOHADA (chantier réactivé, phase 6 — 14 oct. 2026) —
// regroupement réglementaire par rubrique, réservé au bouquet
// "comptabiliteSyscohada" (voir FinanceSubNav, groupe "Comptabilité SYSCOHADA").
// Toujours une estimation de pilotage, jamais une liasse certifiée : voir le
// bandeau d'avertissement affiché sous chaque tableau normalisé.
interface BilanNormalise {
  asOf: string;
  actif: { immobilise: LigneEtat[]; circulant: LigneEtat[]; tresorerie: LigneEtat[] };
  passif: { capitauxPropres: LigneEtat[]; dettesFinancieres: LigneEtat[]; circulant: LigneEtat[] };
  totalActif: number;
  totalPassif: number;
  equilibre: boolean;
}

interface CompteDeResultatNormalise {
  periode: { from: string; to: string };
  exploitation: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  financier: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  resultatActivitesOrdinaires: number;
  hao: { produits: LigneEtat[]; charges: LigneEtat[]; resultat: number };
  resultatNetAvantImpot: number;
  statut: string;
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

function ComptabiliteContenu() {
  const { currentShop } = useShop();
  const [from, setFrom] = useState(debutMois());
  const [to, setTo] = useState(aujourdhui());
  const [asOf, setAsOf] = useState(aujourdhui());
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
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    const toExclusif = new Date(to);
    toExclusif.setDate(toExclusif.getDate() + 1);
    const params = `from=${from}&to=${toExclusif.toISOString().slice(0, 10)}`;

    const requete =
      vue === "journal"
        ? api.get<Ecriture[]>(`/shops/${currentShop.id}/finance/journal?${params}`).then(setJournal)
        : vue === "balance"
        ? api.get<Balance>(`/shops/${currentShop.id}/finance/balance?${params}`).then(setBalance)
        : vue === "grand-livre"
        ? api
            .get<GrandLivre>(`/shops/${currentShop.id}/finance/grand-livre?compte=${compteChoisi}&${params}`)
            .then(setGrandLivre)
        : vue === "compte-resultat"
        ? api
            .get<CompteDeResultat>(`/shops/${currentShop.id}/finance/compte-resultat?${params}`)
            .then(setCompteResultat)
        : vue === "compte-resultat-normalise"
        ? api
            .get<CompteDeResultatNormalise>(`/shops/${currentShop.id}/finance/compte-resultat-normalise?${params}`)
            .then(setCompteResultatNormalise)
        : vue === "bilan"
        ? (() => {
            const asOfExclusif = new Date(asOf);
            asOfExclusif.setDate(asOfExclusif.getDate() + 1);
            return api
              .get<Bilan>(`/shops/${currentShop.id}/finance/bilan?asOf=${asOfExclusif.toISOString().slice(0, 10)}`)
              .then(setBilan);
          })()
        : (() => {
            const asOfExclusif = new Date(asOf);
            asOfExclusif.setDate(asOfExclusif.getDate() + 1);
            return api
              .get<BilanNormalise>(
                `/shops/${currentShop.id}/finance/bilan-normalise?asOf=${asOfExclusif.toISOString().slice(0, 10)}`,
              )
              .then(setBilanNormalise);
          })();

    requete
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop, vue, from, to, asOf, compteChoisi]);

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Journal, grand livre et balance générés automatiquement à partir des
        opérations réellement enregistrées (ventes, charges, achats,
        commandes Marketplace reçues, factures réglées) — voir{" "}
        <em>docs/ARCHITECTURE_FINANCE.md</em>. Le compte de résultat et le
        bilan sont des estimations générées automatiquement à partir de ces
        mêmes écritures : ils ne remplacent pas une comptabilité tenue par
        un professionnel et ne constituent pas une liasse fiscale (pas de
        clôture d&apos;exercice, pas de verrouillage de période à cette
        phase). La créance « 411 » (ventes Marketplace) ne se solde jamais
        automatiquement tant qu&apos;aucun reversement réel de fonds par la
        plateforme n&apos;est modélisé.
      </p>

      <div className={styles.formulaire}>
        {vue === "bilan" || vue === "bilan-normalise" ? (
          <div className={styles.champ}>
            <label>À la date du</label>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        ) : (
          <>
            <div className={styles.champ}>
              <label>Du</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className={styles.champ}>
              <label>Au</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </>
        )}
        <div className={styles.champ}>
          <label>Vue</label>
          <select value={vue} onChange={(e) => setVue(e.target.value as typeof vue)}>
            <option value="journal">Journal général</option>
            <option value="grand-livre">Grand livre</option>
            <option value="balance">Balance</option>
            <option value="compte-resultat">Compte de résultat</option>
            <option value="bilan">Bilan</option>
            <option value="bilan-normalise">Bilan normalisé SYSCOHADA</option>
            <option value="compte-resultat-normalise">Compte de résultat normalisé SYSCOHADA</option>
          </select>
        </div>
        {vue === "grand-livre" && (
          <div className={styles.champ}>
            <label>Compte</label>
            <select value={compteChoisi} onChange={(e) => setCompteChoisi(e.target.value)}>
              <option value="5711">5711 — Caisse USD</option>
              <option value="5712">5712 — Caisse CDF</option>
              <option value="411">411 — Clients</option>
              <option value="401">401 — Fournisseurs</option>
              <option value="601">601 — Achats de marchandises</option>
              <option value="6220">6220 — Charges de fonctionnement</option>
              <option value="6221">6221 — Charges administratives</option>
              <option value="6222">6222 — Charges commerciales</option>
              <option value="661">661 — Charges de personnel</option>
              <option value="641">641 — Impôts et taxes</option>
              <option value="671">671 — Charges financières</option>
              <option value="701">701 — Ventes de marchandises</option>
              <option value="7012">7012 — Ventes Marketplace</option>
            </select>
          </div>
        )}
      </div>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement ? (
        <p>Chargement…</p>
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
  if (!ecritures) return <p>Aucune donnée.</p>;
  if (ecritures.length === 0) return <p>Aucune écriture sur cette période.</p>;
  return (
    <table className={styles.tableau}>
      <thead>
        <tr>
          <th>Date</th>
          <th>Journal</th>
          <th>Libellé</th>
          <th>Compte</th>
          <th style={{ textAlign: "right" }}>Débit</th>
          <th style={{ textAlign: "right" }}>Crédit</th>
        </tr>
      </thead>
      <tbody>
        {ecritures.map((e) =>
          e.lines.map((l, i) => (
            <tr key={l.id}>
              {i === 0 ? (
                <>
                  <td rowSpan={e.lines.length}>{new Date(e.entryDate).toLocaleDateString("fr-FR")}</td>
                  <td rowSpan={e.lines.length}>{e.journal.code}</td>
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
  if (!data) return <p>Aucune donnée.</p>;
  if (data.mouvements.length === 0) return <p>Aucun mouvement sur ce compte pour cette période.</p>;
  return (
    <>
      <table className={styles.tableau}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Libellé</th>
            <th style={{ textAlign: "right" }}>Débit</th>
            <th style={{ textAlign: "right" }}>Crédit</th>
            <th style={{ textAlign: "right" }}>Solde cumulé</th>
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
      <p style={{ marginTop: "12px", fontWeight: 600 }}>Solde final : {f(data.soldeFinal)} $</p>
      <p style={{ marginTop: "4px", fontSize: "0.75rem", color: "#888" }}>
        Convention : un solde cumulé négatif sur un compte à solde créditeur
        normal (ventes, produits) est correct — il indique l&apos;ampleur du
        crédit accumulé, pas une anomalie.
      </p>
    </>
  );
}

function BalanceTable({ data }: { data: Balance | null }) {
  if (!data) return <p>Aucune donnée.</p>;
  if (data.comptes.length === 0) return <p>Aucun mouvement sur cette période.</p>;
  return (
    <>
      {!data.equilibree && (
        <div className={styles.erreur}>
          Anomalie : le total débit ne correspond pas au total crédit sur
          cette balance — à signaler, ne pas ignorer.
        </div>
      )}
      <table className={styles.tableau}>
        <thead>
          <tr>
            <th>Compte</th>
            <th style={{ textAlign: "right" }}>Débit</th>
            <th style={{ textAlign: "right" }}>Crédit</th>
            <th style={{ textAlign: "right" }}>Solde</th>
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
            <td>Total</td>
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
  if (!data) return <p>Aucune donnée.</p>;
  if (data.charges.length === 0 && data.produits.length === 0) {
    return <p>Aucune charge ni aucun produit sur cette période.</p>;
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
      <div>
        <h3>Charges</h3>
        <table className={styles.tableau}>
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
              <td>Total charges</td>
              <td style={{ textAlign: "right" }}>{f(data.totalCharges)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div>
        <h3>Produits</h3>
        <table className={styles.tableau}>
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
              <td>Total produits</td>
              <td style={{ textAlign: "right" }}>{f(data.totalProduits)} $</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p style={{ gridColumn: "1 / -1", fontWeight: 700, fontSize: "1.1rem" }}>
        Résultat net de la période : {f(data.resultatNet)} $ (
        {data.resultatNet >= 0 ? "bénéfice" : "perte"})
      </p>
    </div>
  );
}

function BilanTable({ data }: { data: Bilan | null }) {
  if (!data) return <p>Aucune donnée.</p>;
  if (data.actif.length === 0 && data.passif.length === 0) {
    return <p>Aucun solde à cette date.</p>;
  }
  return (
    <div>
      {!data.equilibre && (
        <div className={styles.erreur}>
          Anomalie : le total actif ne correspond pas au total passif sur ce bilan — à signaler, ne pas ignorer.
        </div>
      )}
      <p style={{ fontSize: "0.75rem", color: "#888", marginBottom: "8px" }}>
        Convention : des totaux négatifs ici signifient une perte cumulée
        depuis l&apos;origine — le bilan reste équilibré (actif = passif),
        seul le signe du résultat change.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <h3>Actif</h3>
          <table className={styles.tableau}>
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
                <td>Total actif</td>
                <td style={{ textAlign: "right" }}>{f(data.totalActif)} $</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div>
          <h3>Passif</h3>
          <table className={styles.tableau}>
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
                <td>Total passif</td>
                <td style={{ textAlign: "right" }}>{f(data.totalPassif)} $</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function LigneEtatTable({ titre, lignes, total }: { titre: string; lignes: LigneEtat[]; total: number }) {
  return (
    <div>
      <h4 style={{ marginBottom: "6px" }}>{titre}</h4>
      {lignes.length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.8rem" }}>Aucun solde.</p>
      ) : (
        <table className={styles.tableau}>
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
              <td>Sous-total</td>
              <td style={{ textAlign: "right" }}>{f(total)} $</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

const AVERTISSEMENT_SYSCOHADA = (
  <p style={{ fontSize: "0.75rem", color: "#b08900", marginTop: "16px", lineHeight: 1.5 }}>
    État normalisé SYSCOHADA généré automatiquement à partir des mêmes
    écritures que ci-dessus, présenté &laquo;&nbsp;avant impôt sur les
    bénéfices&nbsp;&raquo; (aucune charge d&apos;impôt n&apos;est encore
    comptabilisée). Il reste une estimation de pilotage interne : seul un
    expert-comptable habilité peut établir et certifier une liasse
    SYSCOHADA/OHADA officielle.
  </p>
);

function BilanNormaliseTable({ data }: { data: BilanNormalise | null }) {
  if (!data) return <p>Aucune donnée.</p>;
  const totalActifLignes = data.actif.immobilise.length + data.actif.circulant.length + data.actif.tresorerie.length;
  const totalPassifLignes =
    data.passif.capitauxPropres.length + data.passif.dettesFinancieres.length + data.passif.circulant.length;
  if (totalActifLignes === 0 && totalPassifLignes === 0) {
    return <p>Aucun solde à cette date.</p>;
  }
  const totalActifImmo = data.actif.immobilise.reduce((s, l) => s + l.montant, 0);
  const totalActifCirc = data.actif.circulant.reduce((s, l) => s + l.montant, 0);
  const totalTresorerie = data.actif.tresorerie.reduce((s, l) => s + l.montant, 0);
  const totalCapitaux = data.passif.capitauxPropres.reduce((s, l) => s + l.montant, 0);
  const totalDettesFin = data.passif.dettesFinancieres.reduce((s, l) => s + l.montant, 0);
  const totalPassifCirc = data.passif.circulant.reduce((s, l) => s + l.montant, 0);
  return (
    <div>
      {!data.equilibre && (
        <div className={styles.erreur}>
          Anomalie : le total actif ne correspond pas au total passif sur ce bilan normalisé — à signaler, ne pas ignorer.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
        <div>
          <h3>Actif</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LigneEtatTable titre="Actif immobilisé" lignes={data.actif.immobilise} total={totalActifImmo} />
            <LigneEtatTable titre="Actif circulant" lignes={data.actif.circulant} total={totalActifCirc} />
            <LigneEtatTable titre="Trésorerie — actif" lignes={data.actif.tresorerie} total={totalTresorerie} />
          </div>
          <p style={{ marginTop: "10px", fontWeight: 700 }}>Total actif : {f(data.totalActif)} $</p>
        </div>
        <div>
          <h3>Passif</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <LigneEtatTable titre="Capitaux propres" lignes={data.passif.capitauxPropres} total={totalCapitaux} />
            <LigneEtatTable titre="Dettes financières" lignes={data.passif.dettesFinancieres} total={totalDettesFin} />
            <LigneEtatTable titre="Passif circulant" lignes={data.passif.circulant} total={totalPassifCirc} />
          </div>
          <p style={{ marginTop: "10px", fontWeight: 700 }}>Total passif : {f(data.totalPassif)} $</p>
        </div>
      </div>
      {AVERTISSEMENT_SYSCOHADA}
    </div>
  );
}

function CompteDeResultatNormaliseTable({ data }: { data: CompteDeResultatNormalise | null }) {
  if (!data) return <p>Aucune donnée.</p>;
  const vide =
    data.exploitation.produits.length === 0 &&
    data.exploitation.charges.length === 0 &&
    data.financier.produits.length === 0 &&
    data.financier.charges.length === 0 &&
    data.hao.produits.length === 0 &&
    data.hao.charges.length === 0;
  if (vide) return <p>Aucune charge ni aucun produit sur cette période.</p>;

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
          <h3>Exploitation</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre="Produits d'exploitation" lignes={data.exploitation.produits} total={totalProduitsExploitation} />
            <LigneEtatTable titre="Charges d'exploitation" lignes={data.exploitation.charges} total={totalChargesExploitation} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>
            Résultat d&apos;exploitation : {f(data.exploitation.resultat)} $
          </p>
        </section>
        <section>
          <h3>Financier</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre="Produits financiers" lignes={data.financier.produits} total={totalProduitsFinanciers} />
            <LigneEtatTable titre="Charges financières" lignes={data.financier.charges} total={totalChargesFinancieres} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>Résultat financier : {f(data.financier.resultat)} $</p>
        </section>
        <p style={{ fontWeight: 700 }}>
          Résultat des activités ordinaires : {f(data.resultatActivitesOrdinaires)} $
        </p>
        <section>
          <h3>Hors activités ordinaires (HAO)</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <LigneEtatTable titre="Produits HAO" lignes={data.hao.produits} total={totalProduitsHAO} />
            <LigneEtatTable titre="Charges HAO" lignes={data.hao.charges} total={totalChargesHAO} />
          </div>
          <p style={{ marginTop: "8px", fontWeight: 700 }}>Résultat HAO : {f(data.hao.resultat)} $</p>
        </section>
      </div>
      <p style={{ marginTop: "16px", fontWeight: 700, fontSize: "1.1rem" }}>
        Résultat net avant impôt : {f(data.resultatNetAvantImpot)} $ (
        {data.resultatNetAvantImpot >= 0 ? "bénéfice" : "perte"})
      </p>
      <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "4px" }}>{data.statut}</p>
      {AVERTISSEMENT_SYSCOHADA}
    </div>
  );
}

export default function ComptabilitePage() {
  return (
    <ProtectedGestionPage>
      <ComptabiliteContenu />
    </ProtectedGestionPage>
  );
}
