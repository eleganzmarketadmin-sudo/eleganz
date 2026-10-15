"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
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
  { valeur: "", cle: "gliv_vehiculeNonPrecise" },
  { valeur: "MOTO", cle: "gliv_vehiculeMoto" },
  { valeur: "VELO", cle: "gliv_vehiculeVelo" },
  { valeur: "VOITURE", cle: "gliv_vehiculeVoiture" },
  { valeur: "A_PIED", cle: "gliv_vehiculeAPied" },
] as const;

const CLES_VEHICULE: Record<string, string> = {
  MOTO: "gliv_vehiculeMoto",
  VELO: "gliv_vehiculeVelo",
  VOITURE: "gliv_vehiculeVoiture",
  A_PIED: "gliv_vehiculeAPied",
};

function LivreursContent() {
  const { currentShop } = useShop();
  const { t } = useLocale();
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
            ? t("gliv_reservePersonnel")
            : err instanceof Error
              ? err.message
              : t("cmd_erreurGenerique"),
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
      setConfirmation(t("gliv_livreurAjoute"));
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gliv_ajoutImpossible"));
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
      setErreur(err instanceof ApiError ? err.message : t("gliv_modificationImpossible"));
    }
  }

  return (
    <div>
      <h1 className={styles.titre}>{t("nav_livreurs")}</h1>
      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

      <form className={styles.formulaire} onSubmit={ajouter}>
        <div className={styles.champ}>
          <label htmlFor="fullName">{t("gliv_labelNom")}</label>
          <input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("gliv_placeholderNom")}
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="phone">{t("gliv_labelTelephone")}</label>
          <input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+243 ..."
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="vehicleType">{t("gliv_labelVehicule")}</label>
          <select id="vehicleType" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            {VEHICULES.map((v) => (
              <option key={v.valeur} value={v.valeur}>
                {t(v.cle)}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={ajoutEnCours || !fullName}>
          {ajoutEnCours ? t("gliv_ajoutEnCours") : t("gliv_ajouterLivreur")}
        </button>
      </form>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "24px" }}>{t("gliv_noteResponsabilite")}</p>

      {chargement ? (
        <p>{t("gliv_chargement")}</p>
      ) : livreurs.length === 0 ? (
        <p>{t("gliv_aucunLivreur")}</p>
      ) : (
        <table className={styles.tableau}>
          <thead>
            <tr>
              <th>{t("eq_colNom")}</th>
              <th>{t("eq_colContact")}</th>
              <th>{t("gliv_colVehicule")}</th>
              <th>{t("eq_colStatut")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {livreurs.map((l) => (
              <tr key={l.id}>
                <td>{l.fullName}</td>
                <td>{l.phone ?? "—"}</td>
                <td>{l.vehicleType ? (CLES_VEHICULE[l.vehicleType] ? t(CLES_VEHICULE[l.vehicleType]) : l.vehicleType) : "—"}</td>
                <td>{l.active ? t("eq_statutActif") : t("eq_statutDesactive")}</td>
                <td>
                  <button className={styles.retirer} onClick={() => basculerActif(l)}>
                    {l.active ? t("gliv_desactiver") : t("gliv_reactiver")}
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
