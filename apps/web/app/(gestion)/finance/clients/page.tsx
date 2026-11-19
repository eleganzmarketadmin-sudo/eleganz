"use client";

import { useEffect, useMemo, useState } from "react";
import { ProtectedGestionPage } from "../../../components/ProtectedGestionPage";
import { FinanceSubNav } from "../../../components/FinanceSubNav";
import { useShop } from "../../../lib/shop-context";
import { api, ApiError } from "../../../lib/api";
import { formatMoney, formatDate } from "../../../lib/money";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Rapport clients (19 nov. 2026, demande : "ajouter un report de
// shopcustomer... dans la boutique") — vue complémentaire à Créances &
// dettes (qui ne liste que les soldes dus) : total des achats, nombre de
// ventes et date du dernier achat par client, calculés côté serveur depuis
// PosSale (voir CustomersService.rapport) plutôt que recalculés ici.
interface TotalAchat {
  currency: string;
  montant: number;
}

interface RapportClient {
  id: string;
  fullName: string;
  phone: string | null;
  creditBalance: number;
  nombreVentes: number;
  dernierAchatAt: string | null;
  totalAchats: TotalAchat[];
}

function formatTotalAchats(totaux: TotalAchat[]): string {
  if (totaux.length === 0) return "—";
  return totaux.map((t) => formatMoney(t.montant, t.currency)).join(" · ");
}

type Tri = "nom" | "ventes" | "dernierAchat" | "creance";

function RapportClientsContenu() {
  const { currentShop } = useShop();
  const { t } = useLocale();
  const [clients, setClients] = useState<RapportClient[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recherche, setRecherche] = useState("");
  const [tri, setTri] = useState<Tri>("nom");

  useEffect(() => {
    if (!currentShop) return;
    let annule = false;
    setChargement(true);
    setErreur(null);
    api
      .get<RapportClient[]>(`/shops/${currentShop.id}/customers/rapport`)
      .then((data) => {
        if (!annule) setClients(data);
      })
      .catch((err) => {
        if (!annule) setErreur(err instanceof ApiError ? err.message : t("rapcli_erreurChargement"));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [currentShop]);

  const clientsAffiches = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const filtres = !q
      ? clients
      : clients.filter((c) => `${c.fullName} ${c.phone ?? ""}`.toLowerCase().includes(q));
    return [...filtres].sort((a, b) => {
      switch (tri) {
        case "ventes":
          return b.nombreVentes - a.nombreVentes;
        case "dernierAchat":
          return (b.dernierAchatAt ?? "").localeCompare(a.dernierAchatAt ?? "");
        case "creance":
          return b.creditBalance - a.creditBalance;
        default:
          return a.fullName.localeCompare(b.fullName);
      }
    });
  }, [clients, recherche, tri]);

  const totalCreances = clients.reduce((s, c) => s + c.creditBalance, 0);

  return (
    <div>
      <h1 className={styles.titre}>{t("rapcli_titre")}</h1>
      <FinanceSubNav />

      <p style={{ color: "#888", fontSize: "0.875rem", marginBottom: "20px" }}>{t("rapcli_noteAide")}</p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement && <p>{t("commun_chargement")}</p>}

      <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        <input
          placeholder={t("rapcli_placeholderRecherche")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          style={{ minWidth: "220px" }}
        />
        <select value={tri} onChange={(e) => setTri(e.target.value as Tri)}>
          <option value="nom">{t("rapcli_triNom")}</option>
          <option value="ventes">{t("rapcli_triVentes")}</option>
          <option value="dernierAchat">{t("rapcli_triDernierAchat")}</option>
          <option value="creance">{t("rapcli_triCreance")}</option>
        </select>
        <span style={{ fontSize: "0.875rem", color: "#888" }}>
          {clients.length} {t("rapcli_clientsLabel")}
          {totalCreances > 0 ? ` — ${t("rapcli_totalCreances")} ${formatMoney(totalCreances)}` : ""}
        </span>
      </div>

      {!chargement && clientsAffiches.length === 0 ? (
        <p style={{ color: "#888", fontSize: "0.875rem" }}>{t("rapcli_aucunClient")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("rapcli_colNom")}</th>
              <th>{t("rapcli_colTelephone")}</th>
              <th style={{ textAlign: "right" }}>{t("rapcli_colNombreVentes")}</th>
              <th style={{ textAlign: "right" }}>{t("rapcli_colTotalAchats")}</th>
              <th>{t("rapcli_colDernierAchat")}</th>
              <th style={{ textAlign: "right" }}>{t("rapcli_colCreance")}</th>
            </tr>
          </thead>
          <tbody>
            {clientsAffiches.map((c) => (
              <tr key={c.id}>
                <td>{c.fullName}</td>
                <td>{c.phone ?? "—"}</td>
                <td style={{ textAlign: "right" }}>{c.nombreVentes}</td>
                <td style={{ textAlign: "right" }}>{formatTotalAchats(c.totalAchats)}</td>
                <td>{c.dernierAchatAt ? formatDate(c.dernierAchatAt) : "—"}</td>
                <td style={{ textAlign: "right", color: c.creditBalance > 0 ? "#c0392b" : undefined }}>
                  {c.creditBalance > 0 ? formatMoney(c.creditBalance) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function RapportClientsPage() {
  return (
    <ProtectedGestionPage>
      <RapportClientsContenu />
    </ProtectedGestionPage>
  );
}
