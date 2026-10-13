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
  const [vue, setVue] = useState<"journal" | "grand-livre" | "balance">("journal");

  const [journal, setJournal] = useState<Ecriture[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [compteChoisi, setCompteChoisi] = useState("5711");
  const [grandLivre, setGrandLivre] = useState<GrandLivre | null>(null);
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
        : api
            .get<GrandLivre>(`/shops/${currentShop.id}/finance/grand-livre?compte=${compteChoisi}&${params}`)
            .then(setGrandLivre);

    requete
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }, [currentShop, vue, from, to, compteChoisi]);

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "16px" }}>
        Journal, grand livre et balance générés automatiquement à partir des
        opérations réellement enregistrées (ventes, charges, achats,
        commandes Marketplace reçues, factures réglées) — voir{" "}
        <em>docs/ARCHITECTURE_FINANCE.md</em>. Cette comptabilisation ne
        remplace pas une comptabilité tenue par un professionnel et ne
        constitue pas un état financier réglementaire (pas de bilan, pas de
        compte de résultat, pas de clôture d&apos;exercice à cette phase).
        La créance « 411 » (ventes Marketplace) ne se solde jamais
        automatiquement tant qu&apos;aucun reversement réel de fonds par la
        plateforme n&apos;est modélisé.
      </p>

      <div className={styles.formulaire}>
        <div className={styles.champ}>
          <label>Du</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label>Au</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className={styles.champ}>
          <label>Vue</label>
          <select value={vue} onChange={(e) => setVue(e.target.value as typeof vue)}>
            <option value="journal">Journal général</option>
            <option value="grand-livre">Grand livre</option>
            <option value="balance">Balance</option>
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
      ) : (
        <BalanceTable data={balance} />
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

export default function ComptabilitePage() {
  return (
    <ProtectedGestionPage>
      <ComptabiliteContenu />
    </ProtectedGestionPage>
  );
}
