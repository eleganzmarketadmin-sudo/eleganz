"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { InstitutionShell } from "../../InstitutionShell";
import { api, ApiError } from "../../../lib/api";
import { ouvrirDocumentPdf } from "../../../lib/pdf";
import { useLocale } from "../../../lib/i18n/LocaleContext";
import styles from "../../page.module.css";

// Instantané figé au moment de la soumission (voir FinanceService.dossierCredit
// et DemandeCreditService.soumettre) — seuls les champs affichés ici sont
// repris ; le JSON stocké en base porte aussi businessPlan/bilanNormalise en
// entier, jamais nécessaires sur cette page de synthèse (le narratif complet
// reste consultable via /institution/boutiques/:shopId quand une boutique est
// liée).
interface SnapshotDossierCredit {
  // Secteur d'activité (18 nov. 2026, chantier "gestion de risque autonome"
  // Phase 2) — info purement déclarative fournie par la boutique, jamais
  // utilisée par ELEGANZ pour quoi que ce soit ; affichée ici pour aider
  // l'institution dans sa propre analyse du dossier.
  secteurActivite: string | null;
  // Documents d'identité (18 nov. 2026, chantier "gestion de risque
  // autonome" Phase 4, volet KYC) — purement déclaratif, jamais vérifié ni
  // authentifié par ELEGANZ ; fourni pour la propre vérification
  // réglementaire de l'institution. Figé au moment de la soumission, comme
  // le reste du snapshot. Optionnel : un snapshot figé AVANT l'ajout de ce
  // champ (candidatures soumises avant le 18 nov. 2026, ex. CR-2026-000001)
  // n'a tout simplement pas cette clé dans son JSON — jamais un tableau
  // vide, absent. Un accès direct à `.length` plante donc dessus (bug
  // signalé le 19 nov. 2026) ; toujours vérifier la présence avant la
  // longueur, comme demande-credit-pdf-renderer.ts le fait déjà.
  documentsIdentite?: { type: string; fileUrl: string; uploadedAt: string }[];
  historiqueMensuel: { mois: string; chiffreAffaires: number; charges: number; resultatNet: number }[];
  bilan: { totalActif: number; totalPassif: number; equilibre: boolean };
  compteDeResultat: { resultatNetAvantImpot: number };
  dettesFournisseurs: number;
  creditClientAccorde: number;
  genereLe: string;
  codeVerification: string;
}

// Analyse de crédit automatisée (chantier "gestion de risque autonome", 16
// nov. 2026) — voir AnalyseCredit dans schema.prisma. `composantes` reste
// typé en souple (chaque composante peut être absente si analysable=false)
// plutôt que de dupliquer ici la forme exacte du JSON serveur.
interface ComposanteAnalyse {
  label: string;
  valeur: number | null;
  points: number;
  poids: number;
  commentaire: string;
}

interface AnalyseCredit {
  id: string;
  analysable: boolean;
  scoreGlobal: number | null;
  notation: "TRES_FAIBLE" | "FAIBLE" | "MODERE" | "ELEVE" | "TRES_ELEVE" | null;
  composantes: { liquidite: ComposanteAnalyse; endettement: ComposanteAnalyse; rentabilite: ComposanteAnalyse; anciennete: ComposanteAnalyse } | null;
  recommandation: string;
  calculeLe: string;
  statutValidation: "EN_ATTENTE" | "VALIDEE" | "REJETEE";
  valideParUserId: string | null;
  valideLe: string | null;
  noteValidation: string | null;
}

function badgeClasseNotation(notation: AnalyseCredit["notation"], styles: Record<string, string>): string {
  if (notation === "TRES_FAIBLE" || notation === "FAIBLE") return styles.badgeAccorde;
  if (notation === "MODERE") return styles.badgeAttention;
  return styles.badgeRefuse;
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
  // Garantie proposée (18 nov. 2026) — purement déclaratif par la
  // boutique, jamais vérifié ni validé par ELEGANZ ; voir le commentaire
  // sur DemandeCredit dans schema.prisma.
  garantieType: string | null;
  garantieDescription: string | null;
  garantieValeurEstimee: number | null;
  snapshotDossierCreditJson: SnapshotDossierCredit | null;
  createdAt: string;
  shop: { id: string; name: string; slug: string } | null;
  decision: DecisionLiee | null;
}

// Exposition de l'institution (chantier "menu Rapports", 19 nov. 2026, volet
// "capitales dans l'analyse crédit") — voir
// RapportPortefeuilleService.expositionPourDemande côté API. Donnée VIVANTE,
// recalculée à chaque chargement de l'écran, à la différence du score
// d'AnalyseCredit (figé au calcul) : jamais mélangée à ses composantes.
interface ExpositionInstitution {
  encoursExistantShop: number | null;
  nombrePretsExistantsShop: number | null;
  encoursTotalPortefeuille: number;
  montantDemande: number;
  partPortefeuilleSiAccorde: number | null;
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
 * exige un shopId réel ; cette page l'indique clairement plutôt que de
 * proposer un formulaire qui échouerait.
 *
 * Chantier "gestion de risque autonome" (16 nov. 2026) : pour une
 * candidature avec boutique liée, le formulaire de décision n'apparaît plus
 * qu'une fois l'analyse de crédit automatique (voir AnalyseCreditService)
 * calculée ET validée par un analyste distinct du décideur — double
 * contrôle réellement appliqué, revérifié côté serveur dans
 * InstitutionPortalService.decider.
 */
function DemandeDetailContenu({ numero }: { numero: string }) {
  const { t } = useLocale();
  const [demande, setDemande] = useState<DemandeCreditDetail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  // Analyse de crédit automatisée (chantier "gestion de risque autonome", 16
  // nov. 2026) — voir AnalyseCreditService. `analyse` reste `undefined`
  // avant le premier chargement (pour ne rien afficher), puis `null` si
  // aucune analyse n'a encore été lancée sur cette candidature.
  const [analyse, setAnalyse] = useState<AnalyseCredit | null | undefined>(undefined);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [erreurAnalyse, setErreurAnalyse] = useState<string | null>(null);

  // Exposition de l'institution (19 nov. 2026) — voir ExpositionInstitution
  // ci-dessus. `undefined` tant que non chargée, pour ne rien afficher
  // plutôt qu'un panneau vide pendant le premier chargement ; silencieuse en
  // cas d'échec (purement informatif, ne doit jamais bloquer le reste de
  // l'écran, comme l'analyse de crédit ci-dessus).
  const [exposition, setExposition] = useState<ExpositionInstitution | null | undefined>(undefined);
  const [noteValidation, setNoteValidation] = useState("");
  const [validationEnCours, setValidationEnCours] = useState(false);

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

  // Export PDF (16 nov. 2026, demande du propriétaire : authenticité/
  // sécurité, toujours pouvoir extraire ou imprimer un dossier client,
  // même pour un besoin interne) — voir InstitutionPortalController.detailDemandeExport.
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreurExport, setErreurExport] = useState<string | null>(null);

  async function telechargerPdf() {
    setExportEnCours(true);
    setErreurExport(null);
    try {
      await ouvrirDocumentPdf(`/institution-portal/demandes/${numero}/export`);
    } catch (err) {
      setErreurExport(err instanceof Error ? err.message : t("inst_erreurGeneration"));
    } finally {
      setExportEnCours(false);
    }
  }

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

  function rechargerAnalyse() {
    api
      .get<AnalyseCredit | null>(`/institution-portal/demandes/${numero}/analyse`)
      .then(setAnalyse)
      .catch(() => setAnalyse(null));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(rechargerAnalyse, [numero]);

  function rechargerExposition() {
    api
      .get<ExpositionInstitution>(`/institution-portal/demandes/${numero}/exposition`)
      .then(setExposition)
      .catch(() => setExposition(null));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(rechargerExposition, [numero]);

  async function lancerAnalyse() {
    setAnalyseEnCours(true);
    setErreurAnalyse(null);
    try {
      const resultat = await api.post<AnalyseCredit>(`/institution-portal/demandes/${numero}/analyse`);
      setAnalyse(resultat);
      setNoteValidation("");
    } catch (err) {
      setErreurAnalyse(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setAnalyseEnCours(false);
    }
  }

  async function validerAnalyse(decision: "VALIDEE" | "REJETEE") {
    if (!analyse) return;
    setValidationEnCours(true);
    setErreurAnalyse(null);
    try {
      const resultat = await api.post<AnalyseCredit>(`/institution-portal/analyses/${analyse.id}/valider`, {
        decision,
        note: noteValidation || undefined,
      });
      setAnalyse(resultat);
    } catch (err) {
      setErreurAnalyse(err instanceof ApiError ? err.message : t("inst_erreurGeneration"));
    } finally {
      setValidationEnCours(false);
    }
  }

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
      <p style={{ marginBottom: "var(--espace-3)" }}>
        <span className={`${styles.badge} ${classeBadge(demande.statut)}`}>{t(`inst_demandeStatut_${demande.statut}`)}</span>
        {" · "}
        {new Date(demande.createdAt).toLocaleDateString("fr-FR")}
      </p>

      {erreurExport && <div className={styles.erreur}>{erreurExport}</div>}
      <button className={styles.bouton} onClick={telechargerPdf} disabled={exportEnCours} style={{ marginBottom: "var(--espace-4)" }}>
        {exportEnCours ? t("dossier_genererEnCours") : t("dossier_telechargerPdf")}
      </button>

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
            {snapshot?.secteurActivite && (
              <tr>
                <td>{t("secteurActiviteLabel")}</td>
                <td>{t(`secteur_${snapshot.secteurActivite}`)}</td>
              </tr>
            )}
            {snapshot && snapshot.documentsIdentite && snapshot.documentsIdentite.length > 0 && (
              <tr>
                <td>{t("kyc_documentsLabel")}</td>
                <td>
                  {snapshot.documentsIdentite.map((doc, i) => (
                    <div key={i}>
                      <a href={doc.fileUrl} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                        {t(`kyc_docType_${doc.type}`)}
                      </a>
                      {" — "}
                      {new Date(doc.uploadedAt).toLocaleDateString("fr-FR")}
                    </div>
                  ))}
                </td>
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
            {demande.garantieType && (
              <tr>
                <td>{t("inst_garantieTypeLabel")}</td>
                <td>
                  {t(`inst_garantieType_${demande.garantieType}`)}
                  {demande.garantieDescription && ` — ${demande.garantieDescription}`}
                  {demande.garantieValeurEstimee != null &&
                    ` (${demande.garantieValeurEstimee.toLocaleString("fr-FR")})`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {demande.garantieType && (
          <p style={{ color: "var(--color-texte-muted)", fontSize: "0.75rem", marginTop: "var(--espace-2)" }}>
            {t("inst_garantieNoteInstitution")}
          </p>
        )}
        {snapshot && snapshot.documentsIdentite && snapshot.documentsIdentite.length > 0 && (
          <p style={{ color: "var(--color-texte-muted)", fontSize: "0.75rem", marginTop: "var(--espace-2)" }}>
            {t("kyc_documentsNoteInstitution")}
          </p>
        )}
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

      {/* Exposition de l'institution (chantier "menu Rapports", 19 nov. 2026,
          volet "capitales dans l'analyse crédit") — toujours affichée, même
          pour une candidature "libre" sans boutique rattachée (seul
          encoursExistantShop devient alors non applicable). Donnée vivante,
          jamais mêlée au score d'AnalyseCredit (figé, voir plus bas). */}
      {exposition && (
        <div className={styles.carte}>
          <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_rapportsExpositionTitre")}</h2>
          <table className={styles.tableau}>
            <tbody>
              <tr>
                <td>{t("inst_rapportsExpositionEncoursShop")}</td>
                <td className="chiffre">
                  {exposition.encoursExistantShop !== null
                    ? exposition.encoursExistantShop.toLocaleString("fr-FR")
                    : t("inst_rapportsExpositionLibre")}
                </td>
              </tr>
              <tr>
                <td>{t("inst_rapportsExpositionPortefeuille")}</td>
                <td className="chiffre">{exposition.encoursTotalPortefeuille.toLocaleString("fr-FR")}</td>
              </tr>
              <tr>
                <td>{t("inst_rapportsExpositionPartSiAccorde")}</td>
                <td className="chiffre">
                  {exposition.partPortefeuilleSiAccorde !== null
                    ? `${(exposition.partPortefeuilleSiAccorde * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`
                    : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Analyse de crédit automatisée (chantier "gestion de risque autonome",
          16 nov. 2026) — seulement pour une candidature avec boutique liée
          (snapshot figé, voir DemandeCreditService.soumettre). Une candidature
          "libre" (demande.shop null) n'a pas de score automatique possible,
          voir le message AnalyseCredit.recommandation renvoyé côté serveur. */}
      {demande.shop && (
        <div className={styles.carte}>
          <h2 style={{ marginBottom: "var(--espace-2)" }}>{t("inst_analyseTitre")}</h2>

          {erreurAnalyse && <div className={styles.erreur}>{erreurAnalyse}</div>}

          {analyse === undefined ? (
            <p>{t("commun_chargement")}</p>
          ) : !analyse ? (
            <>
              <p style={{ color: "var(--color-texte-muted)", marginBottom: "var(--espace-3)" }}>{t("inst_analyseAucune")}</p>
              <button className={styles.bouton} onClick={lancerAnalyse} disabled={analyseEnCours}>
                {analyseEnCours ? t("dossier_genererEnCours") : t("inst_analyseLancer")}
              </button>
            </>
          ) : !analyse.analysable ? (
            <p style={{ color: "var(--color-texte-muted)" }}>{analyse.recommandation}</p>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: "var(--espace-3)", marginBottom: "var(--espace-3)", flexWrap: "wrap" }}>
                <span style={{ fontSize: "2rem", fontWeight: 700 }}>{analyse.scoreGlobal}/100</span>
                <span className={`${styles.badge} ${badgeClasseNotation(analyse.notation, styles)}`}>{t(`inst_notation_${analyse.notation}`)}</span>
                {analyse.statutValidation === "VALIDEE" && <span className={`${styles.badge} ${styles.badgeAccorde}`}>{t("inst_analyseValidee")}</span>}
                {analyse.statutValidation === "REJETEE" && <span className={`${styles.badge} ${styles.badgeRefuse}`}>{t("inst_analyseRejetee")}</span>}
              </div>

              {analyse.composantes && (
                <table className={styles.tableau} style={{ marginBottom: "var(--espace-3)" }}>
                  <tbody>
                    {Object.values(analyse.composantes).map((c) => (
                      <tr key={c.label}>
                        <td>{c.label}</td>
                        <td className="chiffre">
                          {c.points}/{c.poids}
                        </td>
                        <td style={{ color: "var(--color-texte-muted)", fontSize: "0.8125rem" }}>{c.commentaire}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <p style={{ marginBottom: "var(--espace-3)" }}>{analyse.recommandation}</p>

              <p style={{ fontSize: "0.75rem", color: "var(--color-texte-muted)", marginBottom: "var(--espace-3)" }}>
                {t("inst_analyseCalculeeLe")} {new Date(analyse.calculeLe).toLocaleString("fr-FR")}
                {analyse.valideLe && (
                  <>
                    {" · "}
                    {t(analyse.statutValidation === "VALIDEE" ? "inst_analyseValideeLe" : "inst_analyseRejeteeLe")}{" "}
                    {new Date(analyse.valideLe).toLocaleString("fr-FR")}
                  </>
                )}
              </p>
              {analyse.noteValidation && (
                <p style={{ marginBottom: "var(--espace-3)" }}>
                  {t("inst_labelNote")} {analyse.noteValidation}
                </p>
              )}

              {analyse.statutValidation === "EN_ATTENTE" && (
                <>
                  <div className={styles.champ} style={{ marginBottom: "var(--espace-3)" }}>
                    <label>{t("inst_labelNote")}</label>
                    <textarea rows={2} value={noteValidation} onChange={(e) => setNoteValidation(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: "var(--espace-2)", flexWrap: "wrap", marginBottom: "var(--espace-3)" }}>
                    <button className={styles.bouton} onClick={() => validerAnalyse("VALIDEE")} disabled={validationEnCours}>
                      {t("inst_analyseValider")}
                    </button>
                    <button className={styles.boutonSecondaire} onClick={() => validerAnalyse("REJETEE")} disabled={validationEnCours} type="button">
                      {t("inst_analyseRejeter")}
                    </button>
                  </div>
                </>
              )}

              <button className={styles.boutonSecondaire} onClick={lancerAnalyse} disabled={analyseEnCours} type="button">
                {analyseEnCours ? t("dossier_genererEnCours") : t("inst_analyseRelancer")}
              </button>
            </>
          )}
        </div>
      )}

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
      ) : demande.shop && !(analyse && analyse.analysable && analyse.statutValidation === "VALIDEE") ? (
        // Double contrôle réel (chantier "gestion de risque autonome", 16
        // nov. 2026) — même garde que InstitutionPortalService.decider côté
        // serveur : le formulaire de décision n'est proposé qu'une fois
        // l'analyse de crédit calculée ET validée par un analyste. Le
        // contrôle "même personne" (valideParUserId === décideur) n'est lui
        // vérifié que côté serveur, qui connaît l'identité du décideur au
        // moment de l'envoi — jamais devinable ici avec certitude.
        <div className={styles.carte}>
          <p style={{ color: "var(--color-texte-muted)" }}>{t("inst_decisionVerrouillee")}</p>
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
