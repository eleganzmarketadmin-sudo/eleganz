"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { StatusTag } from "../../components/StatusTag";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface MissionLigne {
  id: string;
  quantity: number;
  variant: { size: string | null; color: string | null; product: { name: string } };
}

interface Mission {
  id: string;
  status: string;
  updatedAt: string;
  lines: MissionLigne[];
  shop: { name: string; invoiceAddress: string | null; invoicePhone: string | null };
  order: {
    buyerWhatsapp: string | null;
    buyerPhone: string | null;
    deliveryCommune: string | null;
    deliveryQuartier: string | null;
    deliveryAvenue: string | null;
    deliveryRepere: string | null;
    deliveryNote: string | null;
  };
}

interface DriverProfile {
  verified: boolean;
}

const CLES_STATUT: Record<string, string> = {
  READY_FOR_PICKUP: "statut_preteEnlevement",
  PICKED_UP: "statut_recupereeLivreur",
  IN_TRANSIT: "statut_enLivraison",
  DELIVERED_DECLARED: "statut_livraisonDeclaree",
  RECEIVED_CONFIRMED: "gcmd_statutReceptionConfirmeeAcheteur",
  CLOSED: "statut_terminee",
  DISPUTED: "statut_enLitige",
  CANCELLED: "statut_annulee",
  REFUNDED: "statut_remboursee",
  RETURN_REQUESTED: "statut_retourDemande",
};

const HUMEUR_PAR_STATUT: Record<string, "paye" | "attente" | "alerte" | "neutre"> = {
  READY_FOR_PICKUP: "attente",
  PICKED_UP: "attente",
  IN_TRANSIT: "attente",
  DELIVERED_DECLARED: "paye",
  RECEIVED_CONFIRMED: "paye",
  CLOSED: "paye",
  DISPUTED: "alerte",
  CANCELLED: "alerte",
};

/** Garde uniquement les chiffres (et le préfixe +) pour construire un lien wa.me. */
function versLienWhatsapp(numero: string): string {
  const chiffres = numero.replace(/[^\d]/g, "");
  return `https://wa.me/${chiffres}`;
}

function MissionsContent() {
  const { t } = useLocale();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [profil, setProfil] = useState<DriverProfile | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [codesPreuve, setCodesPreuve] = useState<Record<string, string>>({});

  function recharger() {
    Promise.all([
      api.get<Mission[]>("/delivery/my-deliveries"),
      api.get<DriverProfile>("/delivery/me"),
    ])
      .then(([m, p]) => {
        setMissions(m);
        setProfil(p);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(recharger, []);

  async function confirmerEnlevement(missionId: string) {
    setEnCours(missionId);
    setErreur(null);
    try {
      await api.post(`/delivery/my-deliveries/${missionId}/picked-up`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("livr_confirmationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function confirmerLivraison(missionId: string) {
    setEnCours(missionId);
    setErreur(null);
    try {
      await api.post(`/delivery/my-deliveries/${missionId}/delivered`, {
        proofCode: codesPreuve[missionId]?.trim() || undefined,
      });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("livr_confirmationImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("livr_chargementMissions")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("livr_mesMissions")}</h1>
      <p className={styles.sousTitre}>
        {t("livr_sousTitreMissions")}
      </p>

      {profil && !profil.verified && (
        <p className={styles.avisNonVerifie}>
          {t("livr_compteNonVerifie")}
        </p>
      )}

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {missions.length === 0 ? (
        <p className={styles.messageVide}>{t("livr_aucuneMission")}</p>
      ) : (
        missions.map((m) => (
          <div className={styles.mission} key={m.id}>
            <div className={styles.entete}>
              <span>{t("livr_missionNumero")} {m.id.slice(0, 8)} — {m.shop.name}</span>
              <StatusTag
                label={CLES_STATUT[m.status] ? t(CLES_STATUT[m.status]) : m.status}
                humeur={HUMEUR_PAR_STATUT[m.status] ?? "neutre"}
              />
            </div>
            <div className={styles.blocAdresse}>
              <div>
                <div className={styles.blocAdresseTitre}>{t("livr_enlevement")}</div>
                <div>{m.shop.name}</div>
                {m.shop.invoiceAddress && <div>{m.shop.invoiceAddress}</div>}
                {m.shop.invoicePhone && <div>{t("livr_telAbrege")} {m.shop.invoicePhone}</div>}
              </div>
              <div>
                <div className={styles.blocAdresseTitre}>{t("livr_livraison")}</div>
                {(m.order.deliveryAvenue || m.order.deliveryQuartier || m.order.deliveryCommune) ? (
                  <div>
                    {[m.order.deliveryAvenue, m.order.deliveryQuartier, m.order.deliveryCommune]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                ) : (
                  <div>{t("livr_adresseNonPrecisee")}</div>
                )}
                {m.order.deliveryRepere && <div>{t("livr_repere")} : {m.order.deliveryRepere}</div>}
                {m.order.deliveryNote && <div>{t("livr_note")} : {m.order.deliveryNote}</div>}
                {m.order.buyerWhatsapp && (
                  <a
                    className={styles.lienWhatsapp}
                    href={versLienWhatsapp(m.order.buyerWhatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("livr_whatsappClient")} : {m.order.buyerWhatsapp}
                  </a>
                )}
                {!m.order.buyerWhatsapp && m.order.buyerPhone && <div>{t("livr_telClient")} : {m.order.buyerPhone}</div>}
              </div>
            </div>
            <div className={styles.corps}>
              {m.lines.map((l) => (
                <div className={styles.ligne} key={l.id}>
                  <span>
                    {[l.variant.product.name, l.variant.size, l.variant.color].filter(Boolean).join(" — ")} ×{" "}
                    {l.quantity}
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              {m.status === "READY_FOR_PICKUP" && (
                <button
                  className={styles.boutonAction}
                  disabled={enCours === m.id}
                  onClick={() => confirmerEnlevement(m.id)}
                >
                  {enCours === m.id ? "…" : t("livr_confirmerEnlevement")}
                </button>
              )}
              {(m.status === "PICKED_UP" || m.status === "IN_TRANSIT") && (
                <>
                  <div className={styles.champProof}>
                    <label htmlFor={`proof-${m.id}`}>{t("livr_codeRemiseOptionnel")}</label>
                    <input
                      id={`proof-${m.id}`}
                      type="text"
                      value={codesPreuve[m.id] ?? ""}
                      onChange={(e) =>
                        setCodesPreuve((v) => ({ ...v, [m.id]: e.target.value }))
                      }
                    />
                  </div>
                  <button
                    className={styles.boutonAction}
                    disabled={enCours === m.id}
                    onClick={() => confirmerLivraison(m.id)}
                  >
                    {enCours === m.id ? "…" : t("livr_confirmerLivraison")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default function MissionsPage() {
  return (
    <LivreurShell>
      <MissionsContent />
    </LivreurShell>
  );
}
