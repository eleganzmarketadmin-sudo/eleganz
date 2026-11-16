"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InstitutionShell } from "../../InstitutionShell";
import { api, ApiError } from "../../../lib/api";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../../page.module.css";

// Instantané figé au moment de la soumission (voir FinanceService.dossierCredit
// et DemandeCreditService.soumettre) — seuls les champs affichés ici sont
// repris ; le JSON stocké en base porte aussi businessPlan/bilanNormalise en
// entier, jamais nécessaires sur cette page de synthèse (le narratif complet
// reste consultable via /institution/boutiques/:shopId quand une boutique est
// liée).
interface SnapshotDossierCredit {
  historiqueMensuel: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[];
  bilan: { totalActif: number; totalPassif: number; equilibre: boolean };
  compteDeResultat: { resultatNetAvantImpot: number };
  dettesFournisseurs: number;
  creditClientAccorde: number;
  genereLe: string;
  codeVerification: string;
}

interface DecisionLiee {
  id: string;
  statut: "ACCORDE" | "REFUSE";
  montant: number;
  tauxAnnuel: number;
  dureeMois: number;
  note: string | null;
  autoriserSuiviRemboursement: boolean;
  loanId: string | null;
  createdAt: string;
}

interface DemandeCreditDetail {
  id: string;
  numero: string;
  statut: string;
  nomDemandeur: string;
  contactTelephone: string | null;
  contactEmail: string | null;
  raisonSociale: string | null;
  montantDemande: number;
  dureeMoisDemandee: number;
  objetFinancement: string | null;
  snapshotDossierCreditJson: SnapshotDossierCredit | null;
  createdAt: string;
  shop: { id: string; name: string; slug: string } | null;
  decision: DecisionLiee | null;
}

const STATUTS_TERMINAUX_POSITIFS = ["ACCORDEE", "DECAISSEE", "EN_REMBOURSEMENT", "SOLDEE"];

function classeBadge(statut: string): string {
  if (statut === "REFUSEE") return styles.badgeRefuse;
  if (STATUTS_TERMINAUX_POSITIFS.includes(statut)) return styles.badgeAccorde;
  return styles.badgeNeutre;
}

/**
 * Détail d'une candidature de crédit numérotée (16 nov. 2026, demande du
 * propriétaire, point 1) — montre l'instantané financier figé à la
 * soumission (jamais une relecture live, voir le commentaire sur
 * DemandeCredit dans schema.prisma), et permet d'y rattacher la décision
 * finale quand une boutique ELEGANZ est liée (`demande.shop`).
 *
 * Limite connue (16 nov. 2026) : une candidature créée librement par
 * l'institution pour un prospect (`creerLibre`, `shop` null) n'a pas encore
 * de route de décision dédiée — `/institution-portal/shops/:shopId/decisions`
 * exige un shopId réel. Phase 2 (AnalyseCredit/scoring) revisite de toute
 * façon tout le parcours de décision ; en attendant, cette page l'indique
 * clairement plutôt que de proposer un formulaire qui échouerait.
 */
function DemandeDetailContenu({ numero }: { numero: string }) {
  const { t } = useLocale();
  const [demande, setDemande] = useState<DemandeCreditDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const [statut, setStatut] = useState<"ACCORDE" | "REFUSE">("ACCORDE");
  const [montant, setMontant] = useState("");
  const [tauxAnnuel, setTauxAnnuel] = useState("");
  const [dureeMois, setDureeMois] = useState("");
  const [note, setNote] = useState("");
  const [autoriserSuivi, setAutoriserSuivi] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurDecision, setErreurDecision] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [prerempli, setPrerempli] = useState(false);

  function recharger() {
    api
      .get<DemandeCreditDetail>(`/institution-portal/demandes/${numero}`)
      .then((d) => {
        setDemande(d);
        if (!prerempli) {
          setMontant(String(d.montantDemande));
          setDureeMois(String(d.dureeMoisDemandee));
          setPrerempli(true);
        }
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("inst_erreurChargement")));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(recharger, [numero]);

  async function soumettreDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!demande || !demande.shop) return;
    const montantN = Number(montant);
    const tauxN = Number(tauxAnnuel);
    const dureeN = Number(dureeMois);
    if (!(montantN > 0) || !(tauxN >= 0) || !(dureeN >= 1)) return;
    setEnvoiEnCours(true);
    setErreurDecision(null);
    setConfirmation(false);
    try {
      await api.post(`/institution-portal/shops/${demande.shop.id}/decisions`, {
        statut,
        montant: montantN,
        tauxAnnuel: tauxN,
        dureeMois: dureeN,
        note: note || undefined,
        autoriserSuiviRemboursement: statut === "ACCORDE" ? autoriserSuivi : undefined,
        demandeCreditId: demande.id,
      });
      setConfirmation(true);
      recharger();
    } catch (err) {
      setErreurDecision(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (erreur) return <div className={styles.erreur}>{erreur}</div>;
  if (!demande) return <p>{t("commun_chargement")}</p>;

  const snapshot = demande.snapshotDossierCreditJson;
  const dernierMois = snapshot && snapshot.historiqueMensuel.length > 0 ? snapshot.historiqueMensuel[snapshot.historiqueMensuel.length - 1] : null;

  return (
    <div>
      <h1 className={styles.titre} style={{ fontFamily: "monospace" }}>
        {demande.numero}
      </h1>
      <p style={{ marginBottom: "var(--espace-4)" }}>
        <span className={`${styles.badge} ${classeBadge(demande.statut)}`}>{t(`inst_demandeStatut_${demande.statut}`)}</span>
        {" · "}
        {new Date(demande.createdAt).toLocaleDateString("fr-FR")}
      </p>

      <div className={styles.carte}>
        <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("inst_demandeInfosTitre")}</h2>
        <table className={styles.tableau}>
          <tbody>
            <tr>
              <td>{t("inst_colDemandeur")}</td>
              <td>{demande.nomDemandeur}</td>
            </tr>
            {demande.raisonSociale && (
              <tr>
                <td>{t("inst_demandeRaisonSociale")}</td>
                <td>{demande.raisonSociale}</td>
              </tr>
            )}
            {(demande.contactTelephone || demande.contactEmail) && (
              <tr>
                <td>{t("inst_demandeContact")}</td>
                <td>{[demande.contactTelephone, demande.contactEmail].filter(Boolean).join(" · ")}</td>
              </tr>
            )}
            <tr>
              <td>{t("credit_labelMontant")}</td>
              <td className="chiffre">{demande.montantDemande.toLocaleString("fr-FR")}</td>
            </tr>
            <tr>
              <td>{t("credit_labelDuree")}</td>
              <td className="chiffre">{demande.dureeMoisDemandee}</td>
            </tr>
            {demande.objetFinancement && (
              <tr>
                <td>{t("credit_bpColObjet")}</td>
                <td>{demande.objetFinancement}</td>
              </tr>
            )}
          </tbody>
        </table>
        {demande.shop && (
          <p style={{ marginTop: "var(--espace-3)" }}>
            <Link href={`/institution/boutiques/${demande.shop.id}`} style={{ textDecoration: "underline" }}>
              {t("inst_voirDossier")}
            </Link>
          </p>
        )}
      </div>

      <div className={styles.carte}>
        <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_snapshotTitre")}</h2>
        {!snapshot ? (
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_snapshotAbsent")}</p>
        ) : (
          <>
            <table className={styles.tableau}>
              <tbody>
                {dernierMois && (
                  <>
                    <tr>
                      <td>{t("inst_snapshotDernierMois")}</td>
                      <td>{dernierMois.mois}</td>
                    </tr>
                    <tr>
                      <td>{t("inst_snapshotChiffreAffaires")}</td>
                      <td className="chiffre">{dernierMois.chiffreAffaires.toLocaleString("fr-FR")}</td>
                    </tr>
                    <tr>
                      <td>{t("inst_snapshotResultatNet")}</td>
                      <td className="chiffre">{dernierMois.resultatNet.toLocaleString("fr-FR")}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 600, paddingTop: "var(--espace-3)" }}>
                    {t("inst_snapshotBilanTitre")}
                  </td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotTotalActif")}</td>
                  <td className="chiffre">{snapshot.bilan.totalActif.toLocaleString("fr-FR")}</td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotTotalPassif")}</td>
                  <td className="chiffre">{snapshot.bilan.totalPassif.toLocaleString("fr-FR")}</td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotEquilibre")}</td>
                  <td>{snapshot.bilan.equilibre ? t("commun_oui") : t("commun_non")}</td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotResultatNetAvantImpot")}</td>
                  <td className="chiffre">{snapshot.compteDeResultat.resultatNetAvantImpot.toLocaleString("fr-FR")}</td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotDettesFournisseurs")}</td>
                  <td className="chiffre">{snapshot.dettesFournisseurs.toLocaleString("fr-FR")}</td>
                </tr>
                <tr>
                  <td>{t("inst_snapshotCreditClient")}</td>
                  <td className="chiffre">{snapshot.creditClientAccorde.toLocaleString("fr-FR")}</td>
                </tr>
              </tbody>
            </table>
            <p style={{ marginTop: "var(--espace-3)", fontSize: "0.75rem", color: "var(--color-texte-muted)" }}>
              {t("inst_snapshotGenereLe")} {new Date(snapshot.genereLe).toLocaleString("fr-FR")} · {t("inst_snapshotCodeVerification")}{" "}
              {snapshot.codeVerification}
            </p>
          </>
        )}
      </div>

      {demande.decision ? (
        <div className={styles.carte}>
          <h2 style={{ marginBottom: "var(--espace-3)" }}>{t("inst_decisionsPrecedentesTitre")}</h2>
          <table className={styles.tableau}>
            <tbody>
              <tr>
                <td>{t("inst_colStatut")}</td>
                <td>
                  <span className={`${styles.badge} ${demande.decision.statut === "ACCORDE" ? styles.badgeAccorde : styles.badgeRefuse}`}>
                    {t(demande.decision.statut === "ACCORDE" ? "inst_statutAccorde" : "inst_statutRefuse")}
                  </span>
                </td>
              </tr>
              <tr>
                <td>{t("credit_labelMontant")}</td>
                <td className="chiffre">{demande.decision.montant.toLocaleString("fr-FR")}</td>
              </tr>
              <tr>
                <td>{t("credit_labelTaux")}</td>
                <td className="chiffre">{demande.decision.tauxAnnuel.toLocaleString("fr-FR")} %</td>
              </tr>
              <tr>
                <td>{t("credit_labelDuree")}</td>
                <td className="chiffre">{demande.decision.dureeMois}</td>
              </tr>
              {demande.decision.note && (
                <tr>
                  <td>{t("inst_labelNote")}</td>
                  <td>{demande.decision.note}</td>
                </tr>
              )}
              {demande.decision.loanId && (
                <tr>
                  <td></td>
                  <td>
                    <span className={`${styles.badge} ${styles.badgeDecaisse}`}>{t("inst_statutDecaisse")}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : demande.shop ? (
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
      ) : (
        <div className={styles.carte}>
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_demandeAucuneDecisionPossible")}</p>
        </div>
      )}
    </div>
  );
}

export default function DemandeDetailPage() {
  const params = useParams<{ numero: string }>();
  return (
    <InstitutionShell>
      <DemandeDetailContenu numero={params.numero} />
    </InstitutionShell>
  );
}
