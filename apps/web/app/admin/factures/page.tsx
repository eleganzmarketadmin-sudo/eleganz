"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatMoney, formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { StatusTag } from "../../components/StatusTag";
import styles from "./page.module.css";

interface FactureBase {
  id: string;
  amount: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  kind: string;
  createdAt: string;
  reminderStage: number;
  penaltyDays: number | null;
  penaltyAmount: string | null;
}

interface Facture extends FactureBase {
  shopId: string;
  shop: { id: string; name: string };
}

interface FactureLivreur extends FactureBase {
  driverId: string;
  driver: { id: string; user: { fullName: string } };
}

interface FactureComptable extends FactureBase {
  subscriptionId: string;
  subscription: { id: string; user: { fullName: string } };
}

// Factures de commission institution (19 nov. 2026, demande du propriétaire :
// "les commissions facturées aux institutions doivent figurer dans les
// factures du module admin et non dans finances") — pas de `kind`/
// `reminderStage`/`penaltyAmount` : décision explicite du propriétaire,
// aucun moteur de relances/pénalité/suspension ne s'applique ici (voir
// ListeFacturesInstitutions ci-dessous).
interface FactureInstitution {
  id: string;
  amount: string;
  devise: string;
  dueAt: string;
  paidAt: string | null;
  status: string;
  institution: { id: string; name: string };
  loan: { id: string; label: string; shop: { id: string; name: string } | null };
}

interface PaymentProof {
  id: string;
  fileUrl: string;
  note: string | null;
  submittedAt: string;
}

interface DemandeReactivation {
  id: string;
  requestedAt: string;
  status: string;
  shop?: { id: string; name: string };
  driver?: { id: string; user: { fullName: string } };
  subscription?: { id: string; user: { fullName: string } };
}

const CLES_STATUT: Record<string, string> = {
  PENDING: "admfact_statutEnAttente",
  PAID: "admfact_statutPayee",
  OVERDUE: "admfact_statutEnRetard",
  WAIVED: "admfact_statutDispensee",
};

// Relances numérotées (16 nov. 2026, chantier relances/recouvrement) —
// mêmes paliers que Invoice.reminderStage/dunning.util.TITRE_PALIER côté
// API : 0=aucune, 1/2/3=relances numérotées, 4=avertissement,
// 5=suspension notifiée. Paliers 0-2 restent "attente" (humeur StatusTag),
// 3-5 basculent en "alerte" (demande du plan §4).
const CLES_PALIER: Record<number, string> = {
  0: "admfact_palier0",
  1: "admfact_palier1",
  2: "admfact_palier2",
  3: "admfact_palier3",
  4: "admfact_palier4",
  5: "admfact_palier5",
};

function humeurPalier(palier: number): "attente" | "alerte" {
  return palier >= 3 ? "alerte" : "attente";
}

/**
 * Panneau déroulant "preuve de paiement" (16 nov. 2026) — chargé à la
 * demande (pas à l'ouverture de la liste, pour ne pas multiplier les
 * requêtes sur une liste de factures potentiellement longue). `basePath`
 * pointe vers le contrôleur du domaine (ex. "/admin/billing").
 */
function PanneauPreuves({ basePath, invoiceId }: { basePath: string; invoiceId: string }) {
  const { t } = useLocale();
  const [preuves, setPreuves] = useState<PaymentProof[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PaymentProof[]>(`${basePath}/invoices/${invoiceId}/proofs`)
      .then(setPreuves)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")));
  }, [basePath, invoiceId]);

  if (erreur) return <p className={styles.erreur}>{erreur}</p>;
  if (preuves === null) return <p className={styles.messageVide}>{t("admfact_chargementFactures")}</p>;
  if (preuves.length === 0) return <p className={styles.messageVide}>{t("admfact_aucunePreuve")}</p>;

  return (
    <div className={styles.proofPanel}>
      {preuves.map((p) => (
        <div key={p.id} className={styles.proofLigne}>
          <a href={p.fileUrl} target="_blank" rel="noreferrer" className={styles.proofLink}>
            {t("admfact_voirPreuve")}
          </a>
          <span className={styles.statutHistorique}>{formatDate(p.submittedAt)}</span>
          {p.note && <span>{p.note}</span>}
        </div>
      ))}
    </div>
  );
}

/**
 * Liste de factures d'un domaine (boutiques/livreurs/comptable) — même
 * composant générique pour les trois, paramétré par `basePath` et les
 * accesseurs propres à chaque modèle (16 nov. 2026, chantier relances/
 * recouvrement). Porte : sélection multiple + relance groupée, badge de
 * palier, indicateur 📎 preuve de paiement, affichage de la pénalité une
 * fois figée, et le bouton "Marquer payée" déjà existant.
 */
function ListeFactures<F extends FactureBase>({
  basePath,
  enAttente,
  historique,
  nomGetter,
  kindLabelGetter,
  labelVideEnAttente,
  labelVideHistorique,
  onChange,
}: {
  basePath: string;
  enAttente: F[];
  historique: F[];
  nomGetter: (f: F) => string;
  kindLabelGetter: (f: F) => string;
  labelVideEnAttente: string;
  labelVideHistorique: string;
  onChange: () => void;
}) {
  const { t } = useLocale();
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [preuveOuverte, setPreuveOuverte] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function basculerSelection(id: string) {
    setSelection((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  }

  function messageApresPaiement(resultat: { reactivee: boolean; facturesRestantes: number; penaltyAmount?: number }) {
    const base = resultat.reactivee
      ? t("admfact_paiementEtReactivation")
      : t("admfact_paiementMaisFacturesRestantes").replace("{{n}}", String(resultat.facturesRestantes));
    if (resultat.penaltyAmount && resultat.penaltyAmount > 0) {
      return `${base} ${t("admfact_penalite")} : ${formatMoney(resultat.penaltyAmount)}.`;
    }
    return base;
  }

  async function marquerPayee(invoiceId: string) {
    setEnCours(invoiceId);
    setErreur(null);
    setMessage(null);
    try {
      const resultat = await api.post<{ reactivee: boolean; facturesRestantes: number; penaltyAmount?: number }>(
        `${basePath}/invoices/${invoiceId}/mark-paid`,
      );
      setMessage(messageApresPaiement(resultat));
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function envoyerRelanceGroupee() {
    if (selection.size === 0) {
      setErreur(t("admfact_selectionnerAuMoinsUne"));
      return;
    }
    setEnCours("bulk-remind");
    setErreur(null);
    setMessage(null);
    try {
      const resultats = await api.post<{ invoiceId: string; action: string }[]>(`${basePath}/invoices/bulk-remind`, {
        invoiceIds: [...selection],
      });
      const envoyees = resultats.filter((r) => r.action === "relance_envoyee").length;
      setMessage(t("admfact_relanceEnvoyeeA").replace("{{n}}", String(envoyees)));
      setSelection(new Set());
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      {enAttente.length > 0 && (
        <div className={styles.bandeauActions}>
          <span className={styles.statutHistorique}>
            {selection.size} / {enAttente.length}
          </span>
          <button
            className={styles.boutonRelance}
            disabled={enCours !== null}
            onClick={envoyerRelanceGroupee}
          >
            {t("admfact_envoyerRelance")}
          </button>
        </div>
      )}

      {enAttente.length === 0 ? (
        <p className={styles.messageVide}>{labelVideEnAttente}</p>
      ) : (
        enAttente.map((f) => (
          <div className={styles.factureBloc} key={f.id}>
            <div className={styles.facture}>
              <div className={styles.factureInfo}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={selection.has(f.id)}
                  onChange={() => basculerSelection(f.id)}
                />
                <span className={styles.boutiqueNom}>{nomGetter(f)}</span>
                <span>{kindLabelGetter(f)}</span>
                <span>{formatMoney(Number(f.amount))}</span>
                <span>
                  {t("crd_colEcheance")} : {formatDate(f.dueAt)}
                </span>
                {f.reminderStage > 0 && (
                  <StatusTag label={t(CLES_PALIER[f.reminderStage] ?? "admfact_palier0")} humeur={humeurPalier(f.reminderStage)} />
                )}
                <button
                  className={styles.boutonProof}
                  onClick={() => setPreuveOuverte(preuveOuverte === f.id ? null : f.id)}
                >
                  📎 {t("admfact_preuves")}
                </button>
              </div>
              <button className={styles.boutonPayer} disabled={enCours === f.id} onClick={() => marquerPayee(f.id)}>
                {t("admfact_marquerPayee")}
              </button>
            </div>
            {preuveOuverte === f.id && <PanneauPreuves basePath={basePath} invoiceId={f.id} />}
          </div>
        ))
      )}

      <h3 className={styles.sousTitre}>{t("admfact_historique")}</h3>
      {historique.length === 0 ? (
        <p className={styles.messageVide}>{labelVideHistorique}</p>
      ) : (
        historique.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{nomGetter(f)}</span>
              <span>{kindLabelGetter(f)}</span>
              <span>{formatMoney(Number(f.amount))}</span>
              {f.penaltyAmount && Number(f.penaltyAmount) > 0 && (
                <span className={styles.penaliteTag}>
                  {t("admfact_penalite")} : {formatMoney(Number(f.penaltyAmount))} ({f.penaltyDays} j)
                </span>
              )}
              <span className={styles.statutHistorique}>{CLES_STATUT[f.status] ? t(CLES_STATUT[f.status]) : f.status}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Factures de commission institution (19 nov. 2026) — volontairement un
 * composant à part plutôt qu'une réutilisation de ListeFactures ci-dessus :
 * pas de sélection/relance groupée, pas de badge de palier, pas de panneau
 * de preuve de paiement, pas de bloc réactivation — décision explicite du
 * propriétaire (voir le commentaire sur InstitutionInvoice dans
 * schema.prisma). Seul "marquer payée" est commun aux deux.
 */
function ListeFacturesInstitutions({
  enAttente,
  historique,
  onChange,
}: {
  enAttente: FactureInstitution[];
  historique: FactureInstitution[];
  onChange: () => void;
}) {
  const { t } = useLocale();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function marquerPayee(invoiceId: string) {
    setEnCours(invoiceId);
    setErreur(null);
    setMessage(null);
    try {
      await api.post(`/admin/billing/institution-invoices/${invoiceId}/mark-paid`);
      setMessage(t("admfact_statutPayee"));
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  return (
    <div>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      {enAttente.length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneFactureInstitutionEnAttente")}</p>
      ) : (
        enAttente.map((f) => {
          const enRetard = new Date(f.dueAt) < new Date();
          return (
            <div className={styles.facture} key={f.id}>
              <div className={styles.factureInfo}>
                <span className={styles.boutiqueNom}>{f.institution.name}</span>
                <span>{f.loan.label}</span>
                {f.loan.shop && <span>{f.loan.shop.name}</span>}
                <span>{formatMoney(Number(f.amount), f.devise)}</span>
                <span>
                  {t("crd_colEcheance")} : {formatDate(f.dueAt)}
                </span>
                {enRetard && <StatusTag label={t("admfact_statutEnRetard")} humeur="alerte" />}
              </div>
              <button className={styles.boutonPayer} disabled={enCours === f.id} onClick={() => marquerPayee(f.id)}>
                {t("admfact_marquerPayee")}
              </button>
            </div>
          );
        })
      )}

      <h3 className={styles.sousTitre}>{t("admfact_historique")}</h3>
      {historique.length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneAutreFactureInstitution")}</p>
      ) : (
        historique.map((f) => (
          <div className={styles.facture} key={f.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{f.institution.name}</span>
              <span>{f.loan.label}</span>
              {f.loan.shop && <span>{f.loan.shop.name}</span>}
              <span>{formatMoney(Number(f.amount), f.devise)}</span>
              <span className={styles.statutHistorique}>{CLES_STATUT[f.status] ? t(CLES_STATUT[f.status]) : f.status}</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/**
 * Demandes de réactivation ouvertes automatiquement dès solde à zéro pour
 * une entité suspendue (16 nov. 2026, décision du propriétaire : ouverture
 * automatique côté demande, mais toujours soumise à validation admin
 * explicite) — jamais de réactivation sans ce passage ici.
 */
function DemandesReactivation({
  basePath,
  nomGetter,
  onChange,
}: {
  basePath: string;
  nomGetter: (d: DemandeReactivation) => string;
  onChange: () => void;
}) {
  const { t } = useLocale();
  const [demandes, setDemandes] = useState<DemandeReactivation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function recharger() {
    api
      .get<DemandeReactivation[]>(`${basePath}/reactivation-requests?status=PENDING`)
      .then(setDemandes)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [basePath]);

  async function decider(id: string, decision: "APPROVE" | "REJECT") {
    setEnCours(id);
    setErreur(null);
    setMessage(null);
    try {
      await api.post(`${basePath}/reactivation-requests/${id}/decision`, { decision });
      setMessage(decision === "APPROVE" ? t("admfact_reactivationApprouvee") : t("admfact_reactivationRejetee"));
      recharger();
      onChange();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admutil_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return null;

  return (
    <div className={styles.reactivationBloc}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}
      {demandes.length === 0 ? (
        <p className={styles.messageVide}>{t("admfact_aucuneDemandeReactivation")}</p>
      ) : (
        demandes.map((d) => (
          <div className={styles.facture} key={d.id}>
            <div className={styles.factureInfo}>
              <span className={styles.boutiqueNom}>{nomGetter(d)}</span>
              <span className={styles.statutHistorique}>{formatDate(d.requestedAt)}</span>
            </div>
            <div className={styles.reactivationActions}>
              <button className={styles.boutonApprouver} disabled={enCours === d.id} onClick={() => decider(d.id, "APPROVE")}>
                {t("admfact_approuver")}
              </button>
              <button className={styles.boutonRejeter} disabled={enCours === d.id} onClick={() => decider(d.id, "REJECT")}>
                {t("admfact_rejeter")}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function FacturesContent() {
  const { t } = useLocale();
  // Filtre optionnel "?kind=commission" (19 nov. 2026, demande du
  // propriétaire : la carte "Commission Marketplace" du Centre de pilotage
  // doit amener directement à SES factures, pas au mélange complet des
  // factures boutiques). Absent = comportement inchangé (tout affiché),
  // comme avant cette demande — seul un lien qui porte explicitement ce
  // paramètre restreint la liste.
  const searchParams = useSearchParams();
  const filtreKind = searchParams.get("kind");
  const [factures, setFactures] = useState<Facture[]>([]);
  const [facturesLivreurs, setFacturesLivreurs] = useState<FactureLivreur[]>([]);
  const [facturesComptable, setFacturesComptable] = useState<FactureComptable[]>([]);
  const [facturesInstitutions, setFacturesInstitutions] = useState<FactureInstitution[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [verificationEnCours, setVerificationEnCours] = useState<string | null>(null);
  const [rafraichissement, setRafraichissement] = useState(0);

  function recharger() {
    Promise.all([
      api.get<Facture[]>("/admin/billing/invoices"),
      api.get<FactureLivreur[]>("/admin/driver-billing/invoices"),
      api.get<FactureComptable[]>("/admin/comptable/invoices"),
      api.get<FactureInstitution[]>("/admin/billing/institution-invoices"),
    ])
      .then(([listeFactures, listeFacturesLivreurs, listeFacturesComptable, listeFacturesInstitutions]) => {
        setFactures(listeFactures);
        setFacturesLivreurs(listeFacturesLivreurs);
        setFacturesComptable(listeFacturesComptable);
        setFacturesInstitutions(listeFacturesInstitutions);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [rafraichissement]);

  function toutRecharger() {
    setRafraichissement((n) => n + 1);
  }

  async function lancerEcheancier() {
    setVerificationEnCours("echeancier");
    setErreur(null);
    setMessage(null);
    try {
      const resultats = await api.post<{ dettes: number; loyers: number; versements: number; achatsFournisseur: number }>(
        "/admin/echeancier/run",
      );
      const total = resultats.dettes + resultats.loyers + resultats.versements + resultats.achatsFournisseur;
      setMessage(
        total === 0
          ? t("admfact_messageAucuneEcheance")
          : `${total}${t("admfact_relancesEnvoyeesSuffixDettesCreances")} ${resultats.dettes}${t("admfact_virgLoyers")} ${resultats.loyers}${t("admfact_virgVersements")} ${resultats.versements}${t("admfact_virgFournisseurs")} ${resultats.achatsFournisseur}).`,
      );
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admfact_verificationImpossible"));
    } finally {
      setVerificationEnCours(null);
    }
  }

  async function lancerVerification(type: "run-trial-check" | "run-suspension-check") {
    setVerificationEnCours(type);
    setErreur(null);
    setMessage(null);
    try {
      // run-suspension-check appelle désormais executerEscaladeFacturesBoutiques
      // (16 nov. 2026) : renvoie {relancesEnvoyees, boutiquesSuspendues}
      // plutôt qu'un tableau — run-trial-check renvoie toujours un tableau.
      const resultats = await api.post<unknown>(`/admin/billing/${type}`);
      if (Array.isArray(resultats)) {
        setMessage(
          resultats.length === 0
            ? t("admfact_messageAucuneBoutiqueConcernee")
            : `${resultats.length} ${t("admfact_messageBoutiquesMisesAJour")}`,
        );
      } else if (resultats && typeof resultats === "object" && "relancesEnvoyees" in resultats) {
        const r = resultats as { relancesEnvoyees: number; boutiquesSuspendues: number };
        setMessage(`${r.relancesEnvoyees} ${t("admfact_relanceEnvoyeeA").replace("{{n}}", "")} — ${r.boutiquesSuspendues} ${t("admfact_messageBoutiquesMisesAJour")}`);
      }
      toutRecharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admfact_verificationImpossible"));
    } finally {
      setVerificationEnCours(null);
    }
  }

  if (chargement) return <p>{t("admfact_chargementFactures")}</p>;

  const facturesBoutiquesFiltrees = filtreKind ? factures.filter((f) => f.kind === filtreKind) : factures;
  const enAttente = facturesBoutiquesFiltrees.filter((f) => f.status === "PENDING");
  const autres = facturesBoutiquesFiltrees.filter((f) => f.status !== "PENDING");
  const livreursEnAttente = facturesLivreurs.filter((f) => f.status === "PENDING");
  const livreursHistorique = facturesLivreurs.filter((f) => f.status !== "PENDING");
  const comptableEnAttente = facturesComptable.filter((f) => f.status === "PENDING");
  const comptableHistorique = facturesComptable.filter((f) => f.status !== "PENDING");
  const institutionsEnAttente = facturesInstitutions.filter((f) => f.status === "PENDING");
  const institutionsHistorique = facturesInstitutions.filter((f) => f.status !== "PENDING");

  return (
    <div>
      <h1 className={styles.titre}>{t("admfact_titre")}</h1>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      {message && <p className={styles.message}>{message}</p>}

      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifFinPeriodeGratuiteLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifFinPeriodeGratuiteDescription")}</p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-trial-check")}
        >
          {t("admfact_verifierMaintenant")}
        </button>
      </div>
      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifRetardsPaiementLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifRetardsPaiementDescription")}</p>
        </div>
        <button
          className={styles.boutonVerif}
          disabled={verificationEnCours !== null}
          onClick={() => lancerVerification("run-suspension-check")}
        >
          {t("admfact_verifierMaintenant")}
        </button>
      </div>
      <div className={styles.verifications}>
        <div>
          <p className={styles.verifLabel}>{t("admfact_verifEcheancierLabel")}</p>
          <p className={styles.verifDescription}>{t("admfact_verifEcheancierDescription")}</p>
        </div>
        <button className={styles.boutonVerif} disabled={verificationEnCours !== null} onClick={lancerEcheancier}>
          {t("admfact_verifierMaintenant")}
        </button>
      </div>

      <h2 className={styles.sectionTitre}>{t("admfact_demandesReactivation")}</h2>

      <h3 className={styles.sousTitre}>{t("nav_boutiques")}</h3>
      <DemandesReactivation basePath="/admin/billing" nomGetter={(d) => d.shop?.name ?? ""} onChange={toutRecharger} />

      <h3 className={styles.sousTitre}>{t("admfact_facturesLivreurs")}</h3>
      <DemandesReactivation
        basePath="/admin/driver-billing"
        nomGetter={(d) => d.driver?.user.fullName ?? ""}
        onChange={toutRecharger}
      />

      <h3 className={styles.sousTitre}>{t("admfact_facturesSecourable")}</h3>
      <DemandesReactivation
        basePath="/admin/comptable"
        nomGetter={(d) => d.subscription?.user.fullName ?? ""}
        onChange={toutRecharger}
      />

      <h2 id="section-boutiques" className={styles.sectionTitre}>
        {t("admfact_enAttentePaiement")}
      </h2>
      {filtreKind && (
        <p className={styles.messageVide}>
          {t("admfact_filtreKindActif")} « {filtreKind} » —{" "}
          <Link href="/admin/factures#section-boutiques">{t("admfact_filtreKindRetirer")}</Link>
        </p>
      )}
      <ListeFactures
        basePath="/admin/billing"
        enAttente={enAttente}
        historique={autres}
        nomGetter={(f) => f.shop.name}
        kindLabelGetter={(f) =>
          f.kind === "opening_fee"
            ? t("admfact_fraisOuverture")
            : f.kind === "subscription"
              ? t("admfact_abonnementMensuel")
              : f.kind === "commission"
                ? t("admfact_kindCommission")
                : f.kind === "boost"
                  ? t("admfact_kindBoost")
                  : f.kind
        }
        labelVideEnAttente={t("admfact_aucuneFactureEnAttente")}
        labelVideHistorique={t("admfact_aucuneAutreFacture")}
        onChange={toutRecharger}
      />

      <h2 id="section-livreurs" className={styles.sectionTitre}>
        {t("admfact_facturesLivreurs")}
      </h2>
      <ListeFactures
        basePath="/admin/driver-billing"
        enAttente={livreursEnAttente}
        historique={livreursHistorique}
        nomGetter={(f) => f.driver.user.fullName}
        kindLabelGetter={(f) => (f.kind === "opening_fee" ? t("admfact_fraisOuverture") : t("admfact_abonnementMensuel"))}
        labelVideEnAttente={t("admfact_aucuneFactureLivreurEnAttente")}
        labelVideHistorique={t("admfact_aucuneAutreFactureLivreur")}
        onChange={toutRecharger}
      />

      <h2 id="section-comptable" className={styles.sectionTitre}>
        {t("admfact_facturesSecourable")}
      </h2>
      <ListeFactures
        basePath="/admin/comptable"
        enAttente={comptableEnAttente}
        historique={comptableHistorique}
        nomGetter={(f) => f.subscription.user.fullName}
        kindLabelGetter={(f) => (f.kind === "yearly" ? t("admfact_abonnementAnnuel") : t("admfact_abonnementMensuel"))}
        labelVideEnAttente={t("admfact_aucuneFactureSecourableEnAttente")}
        labelVideHistorique={t("admfact_aucuneAutreFactureSecourable")}
        onChange={toutRecharger}
      />

      <h2 id="section-institutions" className={styles.sectionTitre}>
        {t("admfact_facturesInstitutions")}
      </h2>
      <ListeFacturesInstitutions
        enAttente={institutionsEnAttente}
        historique={institutionsHistorique}
        onChange={toutRecharger}
      />
    </div>
  );
}

export default function AdminFacturesPage() {
  return (
    <Suspense fallback={null}>
      <AdminShell>
        <FacturesContent />
      </AdminShell>
    </Suspense>
  );
}
