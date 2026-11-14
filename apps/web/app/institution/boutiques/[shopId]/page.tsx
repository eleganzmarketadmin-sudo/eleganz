"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { InstitutionShell } from "../../InstitutionShell";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../../page.module.css";

interface ScenarioPret {
  id: string;
  label: string;
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  objetFinancement: string | null;
  mensualite: number;
}

interface DossierBoutique {
  resumeExecutif: string | null;
  descriptionActivite: string | null;
  marcheEtClientele: string | null;
  strategieCroissance: string | null;
  utilisationFonds: string | null;
  risquesMitigation: string | null;
  canvasSegmentsClientele: string | null;
  canvasPropositionValeur: string | null;
  canvasCanaux: string | null;
  canvasRelationsClients: string | null;
  canvasSourcesRevenus: string | null;
  canvasRessourcesClefs: string | null;
  canvasActivitesClefs: string | null;
  canvasPartenairesClefs: string | null;
  canvasStructureCouts: string | null;
  scenarios: ScenarioPret[];
}

interface Decision {
  id: string;
  shop: { id: string; name: string; slug: string };
  statut: "ACCORDE" | "REFUSE";
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  note: string | null;
  autoriserSuiviRemboursement: boolean;
  loanId: string | null;
  createdAt: string;
}

const CHAMPS_DOSSIER: { cle: Exclude<keyof DossierBoutique, "scenarios">; libelle: string }[] = [
  { cle: "resumeExecutif", libelle: "credit_bpResumeExecutif" },
  { cle: "descriptionActivite", libelle: "credit_bpDescriptionActivite" },
  { cle: "marcheEtClientele", libelle: "credit_bpMarcheEtClientele" },
  { cle: "strategieCroissance", libelle: "credit_bpStrategieCroissance" },
  { cle: "utilisationFonds", libelle: "credit_bpUtilisationFonds" },
  { cle: "risquesMitigation", libelle: "credit_bpRisquesMitigation" },
];

// Business Model Canvas (14 nov. 2026) — lecture seule ici, même source que
// CHAMPS_DOSSIER ci-dessus (BusinessPlanService.obtenir).
const CHAMPS_CANVAS: { cle: Exclude<keyof DossierBoutique, "scenarios">; libelle: string }[] = [
  { cle: "canvasSegmentsClientele", libelle: "credit_canvasSegmentsClientele" },
  { cle: "canvasPropositionValeur", libelle: "credit_canvasPropositionValeur" },
  { cle: "canvasCanaux", libelle: "credit_canvasCanaux" },
  { cle: "canvasRelationsClients", libelle: "credit_canvasRelationsClients" },
  { cle: "canvasSourcesRevenus", libelle: "credit_canvasSourcesRevenus" },
  { cle: "canvasRessourcesClefs", libelle: "credit_canvasRessourcesClefs" },
  { cle: "canvasActivitesClefs", libelle: "credit_canvasActivitesClefs" },
  { cle: "canvasPartenairesClefs", libelle: "credit_canvasPartenairesClefs" },
  { cle: "canvasStructureCouts", libelle: "credit_canvasStructureCouts" },
];

/**
 * Dossier d'une boutique partenaire, vu depuis le portail institutions (14
 * nov. 2026) — lecture du même business plan que Gestion > Finance >
 * Dossier de crédit (BusinessPlanService.obtenir), jamais une copie
 * distincte. L'accès est revérifié côté API à chaque appel
 * (InstitutionPortalService.verifierAcces) : cette page n'est qu'un
 * affichage, jamais la barrière elle-même.
 */
function DossierBoutiqueContenu({ shopId }: { shopId: string }) {
  const { t } = useLocale();
  const [dossier, setDossier] = useState<DossierBoutique | null>(null);
  const [nomBoutique, setNomBoutique] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [decisions, setDecisions] = useState<Decision[]>([]);

  const [statut, setStatut] = useState<"ACCORDE" | "REFUSE">("ACCORDE");
  const [scenarioId, setScenarioId] = useState("");
  const [montant, setMontant] = useState("");
  const [tauxAnnuel, setTauxAnnuel] = useState("");
  const [dureeMois, setDureeMois] = useState("");
  const [note, setNote] = useState("");
  const [autoriserSuivi, setAutoriserSuivi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurDecision, setErreurDecision] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);

  function recharger() {
    api
      .get<DossierBoutique>(`/institution-portal/shops/${shopId}/dossier`)
      .then(setDossier)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
    api
      .get<{ id: string; name: string }[]>("/institution-portal/shops")
      .then((liste) => setNomBoutique(liste.find((b) => b.id === shopId)?.name ?? null))
      .catch(() => {});
    api
      .get<Decision[]>("/institution-portal/decisions")
      .then((liste) => setDecisions(liste.filter((d) => d.shop.id === shopId)))
      .catch(() => {});
  }

  useEffect(recharger, [shopId]);

  function appliquerScenario(id: string) {
    setScenarioId(id);
    const s = dossier?.scenarios.find((sc) => sc.id === id);
    if (s) {
      setMontant(String(s.montant));
      setTauxAnnuel(String(s.tauxAnnuel));
      setDureeMois(String(s.dureeMois));
    }
  }

  async function soumettreDecision(e: React.FormEvent) {
    e.preventDefault();
    const montantN = Number(montant);
    const tauxN = Number(tauxAnnuel);
    const dureeN = Number(dureeMois);
    if (!(montantN > 0) || !(tauxN >= 0) || !(dureeN >= 1)) return;
    setEnvoiEnCours(true);
    setErreurDecision(null);
    setConfirmation(false);
    try {
      await api.post(`/institution-portal/shops/${shopId}/decisions`, {
        statut,
        scenarioId: scenarioId || undefined,
        montant: montantN,
        tauxAnnuel: tauxN,
        dureeMois: dureeN,
        note: note || undefined,
        autoriserSuiviRemboursement: statut === "ACCORDE" ? autoriserSuivi : undefined,
      });
      setConfirmation(true);
      setNote("");
      recharger();
    } catch (err) {
      setErreurDecision(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (erreur) return <div className={styles.erreur}>{erreur}</div>;
  if (!dossier) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{nomBoutique ?? t("inst_dossierTitre")}</h1>

      <div className={styles.carte}>
        <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("inst_dossierTitre")}</h2>
        {CHAMPS_DOSSIER.map(({ cle, libelle }) =>
          dossier[cle] ? (
            <div key={cle} style={{ marginBottom: "var(--espace-3)" }}>
              <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t(libelle)}</p>
              <p style={{ whiteSpace: "pre-wrap" }}>{dossier[cle]}</p>
            </div>
          ) : null,
        )}
        {CHAMPS_DOSSIER.every(({ cle }) => !dossier[cle]) && (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_dossierVide")}</p>
        )}

        {CHAMPS_CANVAS.some(({ cle }) => dossier[cle]) && (
          <>
            <h3 style={{ marginTop: "var(--espace-4)", marginBottom: "var(--espace-2)" }}>{t("credit_canvasTitre")}</h3>
            {CHAMPS_CANVAS.map(({ cle, libelle }) =>
              dossier[cle] ? (
                <div key={cle} style={{ marginBottom: "var(--espace-3)" }}>
                  <p style={{ fontWeight: 600, fontSize: "0.875rem" }}>{t(libelle)}</p>
                  <p style={{ whiteSpace: "pre-wrap" }}>{dossier[cle]}</p>
                </div>
              ) : null,
            )}
          </>
        )}

        <h3 style={{ marginTop: "var(--espace-4)", marginBottom: "var(--espace-2)" }}>{t("credit_bpScenariosTitre")}</h3>
        {dossier.scenarios.length === 0 ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("credit_bpAucunScenario")}</p>
        ) : (
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("credit_bpColLabel")}</th>
                <th>{t("credit_labelMontant")}</th>
                <th>{t("credit_labelTaux")}</th>
                <th>{t("credit_labelDuree")}</th>
                <th>{t("credit_resultatMensualite")}</th>
              </tr>
            </thead>
            <tbody>
              {dossier.scenarios.map((s) => (
                <tr key={s.id}>
                  <td>{s.label}</td>
                  <td className="chiffre">{s.montant.toLocaleString("fr-FR")}</td>
                  <td className="chiffre">{s.tauxAnnuel.toLocaleString("fr-FR")} %</td>
                  <td className="chiffre">{s.dureeMois}</td>
                  <td className="chiffre">{s.mensualite.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {decisions.length > 0 && (
        <div className={styles.carte}>
          <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("inst_decisionsPrecedentesTitre")}</h2>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("inst_colDate")}</th>
                <th>{t("inst_colStatut")}</th>
                <th>{t("credit_labelMontant")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {decisions.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</td>
                  <td>
                    <span className={`${styles.badge} ${d.statut === "ACCORDE" ? styles.badgeAccorde : styles.badgeRefuse}`}>
                      {t(d.statut === "ACCORDE" ? "inst_statutAccorde" : "inst_statutRefuse")}
                    </span>
                  </td>
                  <td className="chiffre">{d.montant.toLocaleString("fr-FR")}</td>
                  <td>
                    {d.loanId && <span className={`${styles.badge} ${styles.badgeDecaisse}`}>{t("inst_statutDecaisse")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.carte}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_nouvelleDecisionTitre")}</h2>
        <p style={{ color: "var(--color-texte-muted)", fontSize: "0.875rem", marginBottom: "var(--espace-3)" }}>
          {t("inst_nouvelleDecisionDescription")}
        </p>

        {erreurDecision && <div className={styles.erreur}>{erreurDecision}</div>}
        {confirmation && <div className={styles.confirmation}>{t("inst_decisionEnregistree")}</div>}

        <form onSubmit={soumettreDecision}>
          <div className={styles.formulaire} style={{ marginBottom: "var(--espace-3)" }}>
            <div className={styles.champ}>
              <label>{t("inst_labelStatutDecision")}</label>
              <select value={statut} onChange={(e) => setStatut(e.target.value as "ACCORDE" | "REFUSE")}>
                <option value="ACCORDE">{t("inst_statutAccorde")}</option>
                <option value="REFUSE">{t("inst_statutRefuse")}</option>
              </select>
            </div>
            {dossier.scenarios.length > 0 && (
              <div className={styles.champ}>
                <label>{t("inst_labelScenarioBase")}</label>
                <select value={scenarioId} onChange={(e) => appliquerScenario(e.target.value)}>
                  <option value="">{t("inst_scenarioLibre")}</option>
                  {dossier.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className={styles.formulaire} style={{ marginBottom: "var(--espace-3)" }}>
            <div className={styles.champ}>
              <label>{t("credit_labelMontant")}</label>
              <input type="number" min="0.01" step="0.01" value={montant} onChange={(e) => setMontant(e.target.value)} required />
            </div>
            <div className={styles.champ}>
              <label>{t("credit_labelTaux")}</label>
              <input type="number" min="0" step="0.1" value={tauxAnnuel} onChange={(e) => setTauxAnnuel(e.target.value)} required />
            </div>
            <div className={styles.champ}>
              <label>{t("credit_labelDuree")}</label>
              <input type="number" min="1" value={dureeMois} onChange={(e) => setDureeMois(e.target.value)} required />
            </div>
          </div>

          <div className={styles.champ} style={{ marginBottom: "var(--espace-3)" }}>
            <label>{t("inst_labelNote")}</label>
            <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {statut === "ACCORDE" && (
            <label style={{ display: "flex", alignItems: "center", gap: "var(--espace-2)", marginBottom: "var(--espace-4)", fontWeight: 500 }}>
              <input type="checkbox" checked={autoriserSuivi} onChange={(e) => setAutoriserSuivi(e.target.checked)} />
              {t("inst_labelAutoriserSuivi")}
            </label>
          )}

          <button className={styles.bouton} type="submit" disabled={envoiEnCours}>
            {envoiEnCours ? t("dossier_genererEnCours") : t("inst_enregistrerDecision")}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function DossierBoutiquePage() {
  const params = useParams<{ shopId: string }>();
  const shopId = params.shopId;
  return (
    <InstitutionShell>
      <DossierBoutiqueContenu shopId={shopId} />
    </InstitutionShell>
  );
}
