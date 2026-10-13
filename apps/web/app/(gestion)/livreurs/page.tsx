"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

// Livreurs propres à la boutique (13 oct. 2026, 1ʳᵉ demande du jour) — le
// réseau de livreurs ouvert à tout le monde est fermé (voir
// livreur/inscription/page.tsx) ; chaque boutique crée et gère maintenant sa
// propre liste de livreurs, sous sa propre responsabilité. Pas de compte, pas
// de vérification ELEGANZ : juste un nom et un moyen de contact, utilisés
// pour l'affectation dans Commandes.
interface ShopDriver {
  id: string;
  fullName: string;
  phone: string | null;
  vehicleType: string | null;
  active: boolean;
}

const VEHICULES = [
  { valeur: "", label: "Non précisé" },
  { valeur: "MOTO", label: "Moto" },
  { valeur: "VELO", label: "Vélo" },
  { valeur: "VOITURE", label: "Voiture" },
  { valeur: "A_PIED", label: "À pied" },
] as const;

const LABELS_VEHICULE: Record<string, string> = {
  MOTO: "Moto",
  VELO: "Vélo",
  VOITURE: "Voiture",
  A_PIED: "À pied",
};

function LivreursContent() {
  const { currentShop } = useShop();
  const [livreurs, setLivreurs] = useState<ShopDriver[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [ajoutEnCours, setAjoutEnCours] = useState(false);

  function recharger() {
    if (!currentShop) return;
    setChargement(true);
    api
      .get<ShopDriver[]>(`/shops/${currentShop.id}/drivers`)
      .then(setLivreurs)
      .catch((err) =>
        setErreur(
          err instanceof ApiError && err.statusCode === 403
            ? "Cette page est réservée au personnel autorisé de la boutique."
            : err instanceof Error
              ? err.message
              : "Erreur.",
        ),
      )
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [currentShop]);

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop || !fullName) return;
    setAjoutEnCours(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/drivers`, {
        fullName,
        phone: phone || undefined,
        vehicleType: vehicleType || undefined,
      });
      setFullName("");
      setPhone("");
      setVehicleType("");
      setConfirmation("Livreur ajouté à votre liste.");
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Ajout impossible.");
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function basculerActif(livreur: ShopDriver) {
    if (!currentShop) return;
    setErreur(null);
    try {
      await api.patch(`/shops/${currentShop.id}/drivers/${livreur.id}`, { active: !livreur.active });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Modification impossible.");
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>Livreurs</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.formulaire} onSubmit={ajouter}>
        <div className={styles.champ}>
          <label htmlFor="fullName">Nom du livreur</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Ex. Jean Mukendi"
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="phone">Téléphone / WhatsApp</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+243 ..."
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="vehicleType">Véhicule</label>
          <select id="vehicleType" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {VEHICULES.map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={ajoutEnCours || !fullName}>
          {ajoutEnCours ? "Ajout…" : "Ajouter ce livreur"}
        </button>
      </form>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "24px" }}>
        Ces livreurs n&apos;ont pas de compte ELEGANZ et ne sont pas vérifiés par la plateforme :
        vous les gérez sous votre propre responsabilité (identité, sérieux, fiabilité). C&apos;est
        votre équipe qui confirme elle-même le ramassage et la livraison depuis l&apos;écran
        Commandes.
      </p>

      {chargement ? (
        <p>Chargement des livreurs…</p>
      ) : livreurs.length === 0 ? (
        <p>Aucun livreur enregistré pour l&apos;instant.</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>Nom</th>
              <th>Contact</th>
              <th>Véhicule</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {livreurs.map((l) => (
              <tr key={l.id}>
                <td>{l.fullName}</td>
                <td>{l.phone ?? "—"}</td>
                <td>{l.vehicleType ? LABELS_VEHICULE[l.vehicleType] ?? l.vehicleType : "—"}</td>
                <td>{l.active ? "Actif" : "Désactivé"}</td>
                <td>
                  <button className={styles.retirer} onClick={() => basculerActif(l)}>
                    {l.active ? "Désactiver" : "Réactiver"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function LivreursPage() {
  return (
    <ProtectedGestionPage>
      <LivreursContent />
    </ProtectedGestionPage>
  );
}
