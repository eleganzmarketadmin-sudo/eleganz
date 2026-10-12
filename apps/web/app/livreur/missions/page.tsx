"use client";

import { useEffect, useState } from "react";
import { LivreurShell } from "../LivreurShell";
import { StatusTag } from "../../components/StatusTag";
import { api, ApiError } from "../../lib/api";
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

const LABELS_STATUT: Record<string, string> = {
  READY_FOR_PICKUP: "À enlever",
  PICKED_UP: "Enlevée",
  IN_TRANSIT: "En livraison",
  DELIVERED_DECLARED: "Livraison déclarée",
  RECEIVED_CONFIRMED: "Réception confirmée par l'acheteur",
  CLOSED: "Terminée",
  DISPUTED: "En litige",
  CANCELLED: "Annulée",
  REFUNDED: "Remboursée",
  RETURN_REQUESTED: "Retour demandé",
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
      .catch((err) => setErreur(err instanceof ApiError ? err.message : "Erreur."))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  async function confirmerEnlevement(missionId: string) {
    setEnCours(missionId);
    setErreur(null);
    try {
      await api.post(`/delivery/my-deliveries/${missionId}/picked-up`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Confirmation impossible.");
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
      setErreur(err instanceof ApiError ? err.message : "Confirmation impossible.");
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>Chargement de vos missions…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Mes missions</h1>
      <p className={styles.sousTitre}>
        Les livraisons qui vous sont affectées, de l&apos;enlèvement chez le
        vendeur jusqu&apos;à la remise au client.
      </p>

      {profil && !profil.verified && (
        <p className={styles.avisNonVerifie}>
          Votre compte n&apos;est pas encore vérifié par l&apos;administration
          ELEGANZ. Vous ne recevrez de missions qu&apos;une fois la
          vérification effectuée.
        </p>
      )}

      {erreur && <p className={styles.erreur}>{erreur}</p>}

      {missions.length === 0 ? (
        <p className={styles.messageVide}>Aucune mission affectée pour l&apos;instant.</p>
      ) : (
        missions.map((m) => (
          <div className={styles.mission} key={m.id}>
            <div className={styles.entete}>
              <span>Mission #{m.id.slice(0, 8)} — {m.shop.name}</span>
              <StatusTag
                label={LABELS_STATUT[m.status] ?? m.status}
                humeur={HUMEUR_PAR_STATUT[m.status] ?? "neutre"}
              />
            </div>
            <div className={styles.blocAdresse}>
              <div>
                <div className={styles.blocAdresseTitre}>Enlèvement</div>
                <div>{m.shop.name}</div>
                {m.shop.invoiceAddress && <div>{m.shop.invoiceAddress}</div>}
                {m.shop.invoicePhone && <div>Tél. {m.shop.invoicePhone}</div>}
              </div>
              <div>
                <div className={styles.blocAdresseTitre}>Livraison</div>
                {(m.order.deliveryAvenue || m.order.deliveryQuartier || m.order.deliveryCommune) ? (
                  <div>
                    {[m.order.deliveryAvenue, m.order.deliveryQuartier, m.order.deliveryCommune]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                ) : (
                  <div>Adresse non précisée</div>
                )}
                {m.order.deliveryRepere && <div>Repère : {m.order.deliveryRepere}</div>}
                {m.order.deliveryNote && <div>Note : {m.order.deliveryNote}</div>}
                {m.order.buyerWhatsapp && (
                  <a
                    className={styles.lienWhatsapp}
                    href={versLienWhatsapp(m.order.buyerWhatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp client : {m.order.buyerWhatsapp}
                  </a>
                )}
                {!m.order.buyerWhatsapp && m.order.buyerPhone && <div>Tél. client : {m.order.buyerPhone}</div>}
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
                  {enCours === m.id ? "…" : "Confirmer l'enlèvement"}
                </button>
              )}
              {(m.status === "PICKED_UP" || m.status === "IN_TRANSIT") && (
                <>
                  <div className={styles.champProof}>
                    <label htmlFor={`proof-${m.id}`}>Code de remise (optionnel)</label>
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
                    {enCours === m.id ? "…" : "Confirmer la livraison"}
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
