"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../../AdminShell";
import { AdminFinanceSubNav } from "../../AdminFinanceSubNav";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../page.module.css";

// Charges et dépenses d'ELEGANZ elle-même (18 oct. 2026, audit du 18 oct.
// 2026, point 7 : "Charges et créances/dettes plateforme") — pendant
// plateforme de (gestion)/finance/charges. Mêmes 6 familles/catégories (le
// serveur valide la liste complète, voir
// apps/api/src/operations/dto/expense.dto.ts), comptabilisées sur les
// comptes génériques 6220/6221/6222/661/641/671 ajoutés au plan comptable
// ELEGANZ pour cette occasion (accounting-seed.service.ts).
const GROUPES: { cleGroupe: string; categories: { valeur: string; cle: string }[] }[] = [
  {
    cleGroupe: "cha_groupeFonctionnement",
    categories: [
      { valeur: "loyer", cle: "cha_catLoyer" },
      { valeur: "eau", cle: "cha_catEau" },
      { valeur: "electricite", cle: "cha_catElectricite" },
      { valeur: "internet", cle: "cha_catInternet" },
      { valeur: "telecommunications", cle: "cha_catTelecommunications" },
      { valeur: "transport", cle: "cha_catTransport" },
      { valeur: "carburant", cle: "cha_catCarburant" },
      { valeur: "entretien", cle: "cha_catEntretien" },
      { valeur: "reparations", cle: "cha_catReparations" },
      { valeur: "fournitures", cle: "cha_catFournitures" },
    ],
  },
  {
    cleGroupe: "cha_groupePersonnel",
    categories: [
      { valeur: "salaires", cle: "cha_catSalaires" },
      { valeur: "primes", cle: "cha_catPrimes" },
      { valeur: "charges_sociales", cle: "cha_catChargesSociales" },
    ],
  },
  {
    cleGroupe: "cha_groupeAdministratives",
    categories: [
      { valeur: "frais_bancaires", cle: "cha_catFraisBancaires" },
      { valeur: "honoraires", cle: "cha_catHonoraires" },
      { valeur: "assurances", cle: "cha_catAssurances" },
      { valeur: "abonnements_logiciels", cle: "cha_catAbonnementsLogiciels" },
    ],
  },
  {
    cleGroupe: "cha_groupeCommerciales",
    categories: [
      { valeur: "publicite", cle: "cha_catPublicite" },
      { valeur: "promotions", cle: "cha_catPromotions" },
      { valeur: "livraison", cle: "cha_catLivraison" },
      { valeur: "emballages", cle: "cha_catEmballages" },
      { valeur: "commissions", cle: "cha_catCommissions" },
    ],
  },
  { cleGroupe: "cha_groupeFiscalite", categories: [{ valeur: "impots_taxes", cle: "cha_catImpotsTaxes" }] },
  {
    cleGroupe: "cha_groupeFinancement",
    categories: [
      { valeur: "interets_frais_financiers", cle: "cha_catInteretsFraisFinanciers" },
      { valeur: "remboursement_capital", cle: "cha_catRemboursementCapital" },
    ],
  },
  { cleGroupe: "cha_groupeAutre", categories: [{ valeur: "autre", cle: "cha_catAutre" }] },
];

const CLES_CATEGORIE: Record<string, string> = Object.fromEntries(
  GROUPES.flatMap((g) => g.categories.map((c) => [c.valeur, c.cle])),
);

interface Depense {
  id: string;
  category: string;
  amount: string | number;
  currency: string;
  note: string | null;
  createdAt: string;
}

function ChargesPlateformeContenu() {
  const { t } = useLocale();
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [categorie, setCategorie] = useState(GROUPES[0].categories[0].valeur);
  const [montant, setMontant] = useState("");
  const [devise, setDevise] = useState<"USD" | "CDF">("USD");
  const [note, setNote] = useState("");
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

  function recharger() {
    setChargement(true);
    api
      .get<Depense[]>("/admin/finance/charges")
      .then(setDepenses)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("fin_erreurGenerique")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!montant) return;
    setEnregistrementEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post("/admin/finance/charges", {
        category: categorie,
        amount: Number(montant),
        currency: devise,
        note: note || undefined,
      });
      setMontant("");
      setNote("");
      setConfirmation(t("cha_chargeEnregistree"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("cha_enregistrementImpossible"));
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("admsim_titreCharges")}</h1>
      <AdminFinanceSubNav />
      <h2 style={{ fontSize: "1.1rem", marginBottom: "16px" }}>{t("cha_sousTitre")}</h2>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.message}>{confirmation}</div>}

      <form onSubmit={enregistrer} style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "20px", alignItems: "flex-end" }}>
        <div>
          <label htmlFor="categorie" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("cat_categorie")}</label>
          <select id="categorie" value={categorie} onChange={(e) => setCategorie(e.target.value)} style={{ minHeight: 40 }}>
            {GROUPES.map((g) => (
              <optgroup key={g.cleGroupe} label={t(g.cleGroupe)}>
                {g.categories.map((c) => (
                  <option key={c.valeur} value={c.valeur}>
                    {t(c.cle)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="montant" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("cha_montant")}</label>
          <input id="montant" type="number" min="0" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <div>
          <label htmlFor="devise" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("cha_devise")}</label>
          <select id="devise" value={devise} onChange={(e) => setDevise(e.target.value as "USD" | "CDF")} style={{ minHeight: 40 }}>
            <option value="USD">USD</option>
            <option value="CDF">CDF</option>
          </select>
        </div>
        <div>
          <label htmlFor="note" style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>{t("cha_noteFacultatif")}</label>
          <input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("cha_placeholderNote")} style={{ minHeight: 40, padding: 8 }} />
        </div>
        <button className={styles.bouton} type="submit" disabled={enregistrementEnCours || !montant}>
          {enregistrementEnCours ? t("cha_enregistrementEnCours") : t("cha_enregistrerCharge")}
        </button>
      </form>

      {chargement ? (
        <p>{t("commun_chargement")}</p>
      ) : depenses.length === 0 ? (
        <p>{t("cha_aucuneCharge")}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>{t("cha_colDate")}</th>
              <th style={{ textAlign: "left" }}>{t("cat_categorie")}</th>
              <th style={{ textAlign: "left" }}>{t("cha_montant")}</th>
              <th style={{ textAlign: "left" }}>{t("cha_colNote")}</th>
            </tr>
          </thead>
          <tbody>
            {depenses.map((d) => (
              <tr key={d.id}>
                <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                <td>{CLES_CATEGORIE[d.category] ? t(CLES_CATEGORIE[d.category]) : d.category}</td>
                <td>
                  {Number(d.amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} {d.currency}
                </td>
                <td>{d.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AdminChargesPage() {
  return (
    <AdminShell>
      <ChargesPlateformeContenu />
    </AdminShell>
  );
}
