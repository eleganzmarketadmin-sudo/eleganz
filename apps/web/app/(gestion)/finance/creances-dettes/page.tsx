"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import styles from "../page.module.css";

// Créances & dettes (14 oct. 2026, chantier SYSCOHADA phase 3) — échéancier
// fournisseurs, soldes clients, et relances journalisées (pas d'envoi réel
// de SMS/email à cette phase : un rappel ici est une note, pas une
// notification envoyée).
interface LigneEcheancier {
  purchaseId: string;
  fournisseur: string;
  montant: number;
  dueDate: string | null;
  regle: number;
  restant: number;
  enRetard: boolean;
}

interface Supplier {
  id: string;
  name: string;
  balanceOwed: number;
}

interface Customer {
  id: string;
  fullName: string;
  creditBalance: number;
}

interface LigneRelance {
  id: string;
  direction: "CLIENT" | "FOURNISSEUR";
  message: string;
  envoyeeAt: string;
  customer: { fullName: string } | null;
  supplier: { name: string } | null;
}

function f(n: number): string {
  return Number(n).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

function CreancesDettesContenu() {
  const { currentShop } = useShop();
  const [echeancier, setEcheancier] = useState<LigneEcheancier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [relances, setRelances] = useState<LigneRelance[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [messageRelance, setMessageRelance] = useState<Record<string, string>>({});

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    Promise.all([
      api.get<LigneEcheancier[]>(`/shops/${currentShop.id}/suppliers/echeancier`),
      api.get<Supplier[]>(`/shops/${currentShop.id}/suppliers`),
      api.get<Customer[]>(`/shops/${currentShop.id}/customers`),
      api.get<LigneRelance[]>(`/shops/${currentShop.id}/relances`),
    ])
      .then(([e, s, c, r]) => {
        setEcheancier(e);
        setSuppliers(s);
        setCustomers(c);
        setRelances(r);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(() => {
    recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop]);

  async function envoyerRelance(direction: "CLIENT" | "FOURNISSEUR", id: string) {
    if (!currentShop) return;
    const message = messageRelance[id]?.trim();
    if (!message) return;
    await api.post(`/shops/${currentShop.id}/relances`, {
      direction,
      customerId: direction === "CLIENT" ? id : undefined,
      supplierId: direction === "FOURNISSEUR" ? id : undefined,
      message,
    });
    setMessageRelance((m) => ({ ...m, [id]: "" }));
    recharger();
  }

  async function reglerAchat(supplierId: string, purchaseId: string, restant: number) {
    if (!currentShop) return;
    await api.post(`/shops/${currentShop.id}/suppliers/${supplierId}/settle`, {
      amount: restant,
      purchaseId,
    });
    recharger();
  }

  return (
    <div>
      <h1 className={styles.titre}>Finance &amp; Comptabilité</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "20px" }}>
        Échéancier des achats à crédit, soldes dus par les clients, et
        relances — un rappel enregistré ici est une note interne, pas un
        SMS ou un email réellement envoyé.
      </p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement && <p>Chargement…</p>}

      <h3>Échéancier fournisseurs</h3>
      {echeancier.length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.875rem" }}>
          Aucun achat à crédit avec une échéance saisie.
        </p>
      ) : (
        <table className={styles.tableau} style={{ marginBottom: "28px" }}>
          <thead>
            <tr>
              <th>Fournisseur</th>
              <th>Échéance</th>
              <th style={{ textAlign: "right" }}>Montant</th>
              <th style={{ textAlign: "right" }}>Réglé</th>
              <th style={{ textAlign: "right" }}>Restant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {echeancier.map((l) => {
              const supplier = suppliers.find((s) => s.name === l.fournisseur);
              return (
                <tr key={l.purchaseId} style={l.enRetard && l.restant > 0 ? { color: "#c0392b" } : undefined}>
                  <td>{l.fournisseur}</td>
                  <td>{l.dueDate ? new Date(l.dueDate).toLocaleDateString("fr-FR") : "—"}</td>
                  <td style={{ textAlign: "right" }}>{f(l.montant)}</td>
                  <td style={{ textAlign: "right" }}>{f(l.regle)}</td>
                  <td style={{ textAlign: "right" }}>{f(l.restant)}</td>
                  <td>
                    {l.restant > 0.009 && supplier && (
                      <button onClick={() => reglerAchat(supplier.id, l.purchaseId, l.restant)}>
                        Marquer réglé
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <h3>Dettes fournisseurs (solde cumulé)</h3>
      {suppliers.filter((s) => Number(s.balanceOwed) > 0).length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "28px" }}>Aucune dette en cours.</p>
      ) : (
        <ul style={{ marginBottom: "28px" }}>
          {suppliers
            .filter((s) => Number(s.balanceOwed) > 0)
            .map((s) => (
              <li key={s.id} style={{ marginBottom: "6px" }}>
                {s.name} — {f(s.balanceOwed)} $
                <input
                  placeholder="Relance..."
                  value={messageRelance[s.id] ?? ""}
                  onChange={(e) => setMessageRelance((m) => ({ ...m, [s.id]: e.target.value }))}
                  style={{ marginLeft: "12px", width: "220px" }}
                />
                <button onClick={() => envoyerRelance("FOURNISSEUR", s.id)} style={{ marginLeft: "6px" }}>
                  Enregistrer une relance
                </button>
              </li>
            ))}
        </ul>
      )}

      <h3>Créances clients (solde cumulé)</h3>
      {customers.filter((c) => Number(c.creditBalance) > 0).length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "28px" }}>Aucune créance en cours.</p>
      ) : (
        <ul style={{ marginBottom: "28px" }}>
          {customers
            .filter((c) => Number(c.creditBalance) > 0)
            .map((c) => (
              <li key={c.id} style={{ marginBottom: "6px" }}>
                {c.fullName} — {f(c.creditBalance)} $
                <input
                  placeholder="Relance..."
                  value={messageRelance[c.id] ?? ""}
                  onChange={(e) => setMessageRelance((m) => ({ ...m, [c.id]: e.target.value }))}
                  style={{ marginLeft: "12px", width: "220px" }}
                />
                <button onClick={() => envoyerRelance("CLIENT", c.id)} style={{ marginLeft: "6px" }}>
                  Enregistrer une relance
                </button>
              </li>
            ))}
        </ul>
      )}

      <h3>Historique des relances</h3>
      {relances.length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.875rem" }}>Aucune relance enregistrée.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Cible</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {relances.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.envoyeeAt).toLocaleDateString("fr-FR")}</td>
                <td>{r.direction === "CLIENT" ? r.customer?.fullName : r.supplier?.name}</td>
                <td>{r.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function CreancesDettesPage() {
  return (
    <ProtectedGestionPage>
      <CreancesDettesContenu />
    </ProtectedGestionPage>
  );
}
