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

// Réseau de livreurs ELEGANZ (20 nov. 2026, réouverture) : enum
// DriverVehicleType (PIED/VELO/MOTO/VOITURE) distinct de celui, propre à
// ShopDriver, ci-dessus (A_PIED) — même libellé affiché, clé i18n réutilisée.
const VEHICULES_RESEAU = ["", "PIED", "VELO", "MOTO", "VOITURE"] as const;

const CLES_VEHICULE_RESEAU: Record<string, string> = {
  PIED: "gliv_vehiculeAPied",
  VELO: "gliv_vehiculeVelo",
  MOTO: "gliv_vehiculeMoto",
  VOITURE: "gliv_vehiculeVoiture",
};

interface LivreurReseau {
  id: string;
  zone: string | null;
  phone: string | null;
  whatsapp: string | null;
  vehicleType: string | null;
  conditions: string | null;
  user: { fullName: string };
}

interface AccesLivreurReseau {
  id: string;
  status: "PENDING" | "ACTIVE" | "DECLINED" | "REVOKED";
  createdAt: string;
  driver: LivreurReseau;
}

const CLES_STATUT_ACCES: Record<string, string> = {
  PENDING: "gliv_roster_statutEnAttente",
  ACTIVE: "gliv_roster_statutActif",
  DECLINED: "gliv_roster_statutRefuse",
  REVOKED: "gliv_roster_statutRevoque",
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

  // Réseau de livreurs ELEGANZ : recherche + liste de livreurs agréés
  // (20 nov. 2026, réouverture — voir ShopDriverAccess, delivery.service.ts).
  const [zoneRecherche, setZoneRecherche] = useState("");
  const [vehiculeRecherche, setVehiculeRecherche] = useState("");
  const [resultats, setResultats] = useState<LivreurReseau[] | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [demandeEnCours, setDemandeEnCours] = useState<string | null>(null);
  const [agrees, setAgrees] = useState<AccesLivreurReseau[]>([]);
  const [chargementAgrees, setChargementAgrees] = useState(true);
  const [revocationEnCours, setRevocationEnCours] = useState<string | null>(null);

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

  function rechargerAgrees() {
    if (!currentShop) return;
    setChargementAgrees(true);
    api
      .get<AccesLivreurReseau[]>(`/shops/${currentShop.id}/driver-network/roster`)
      .then(setAgrees)
      .catch(() => {})
      .finally(() => setChargementAgrees(false));
  }

  useEffect(recharger, [currentShop]);
  useEffect(rechargerAgrees, [currentShop]);

  async function rechercherLivreurs(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop) return;
    setRechercheEnCours(true);
    setErreur(null);
    try {
      const params = new URLSearchParams();
      if (zoneRecherche.trim()) params.set("zone", zoneRecherche.trim());
      if (vehiculeRecherche) params.set("vehicleType", vehiculeRecherche);
      const qs = params.toString();
      const resultat = await api.get<LivreurReseau[]>(
        `/shops/${currentShop.id}/driver-network/search${qs ? `?${qs}` : ""}`,
      );
      setResultats(resultat);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gliv_roster_demandeImpossible"));
    } finally {
      setRechercheEnCours(false);
    }
  }

  async function demanderAjout(driverId: string) {
    if (!currentShop) return;
    setDemandeEnCours(driverId);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.post(`/shops/${currentShop.id}/driver-network/roster/${driverId}`);
      setConfirmation(t("gliv_roster_demandeEnvoyee"));
      rechargerAgrees();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gliv_roster_demandeImpossible"));
    } finally {
      setDemandeEnCours(null);
    }
  }

  async function revoquerAcces(accessId: string) {
    if (!currentShop) return;
    setRevocationEnCours(accessId);
    setErreur(null);
    try {
      await api.delete(`/shops/${currentShop.id}/driver-network/roster/${accessId}`);
      rechargerAgrees();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("gliv_roster_revocationImpossible"));
    } finally {
      setRevocationEnCours(null);
    }
  }

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
        <div className={styles.tableauScroll}>
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
        </div>
      )}

      <h2 className={styles.titre} style={{ marginTop: "48px" }}>
        {t("gliv_roster_titreRecherche")}
      </h2>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "16px" }}>
        {t("gliv_roster_sousTitreRecherche")}
      </p>
      <form className={styles.formulaire} onSubmit={rechercherLivreurs}>
        <div className={styles.champ}>
          <label htmlFor="zoneRecherche">{t("gliv_roster_labelZone")}</label>
          <input
            id="zoneRecherche"
            value={zoneRecherche}
            onChange={(e) => setZoneRecherche(e.target.value)}
            placeholder={t("gliv_roster_placeholderZone")}
          />
        </div>
        <div className={styles.champ}>
          <label htmlFor="vehiculeRecherche">{t("gliv_labelVehicule")}</label>
          <select
            id="vehiculeRecherche"
            value={vehiculeRecherche}
            onChange={(e) => setVehiculeRecherche(e.target.value)}
          >
            {VEHICULES_RESEAU.map((v) => (
              <option key={v} value={v}>
                {v ? t(CLES_VEHICULE_RESEAU[v]) : t("gliv_roster_tousVehicules")}
              </option>
            ))}
          </select>
        </div>
        <button className={styles.bouton} type="submit" disabled={rechercheEnCours}>
          {rechercheEnCours ? t("gliv_roster_rechercheEnCours") : t("gliv_roster_boutonRechercher")}
        </button>
      </form>

      {resultats !== null && (
        resultats.length === 0 ? (
          <p>{t("gliv_roster_aucunResultat")}</p>
        ) : (
          <div className={styles.tableauScroll}>
            <table className={styles.tableau}>
              <thead>
                <tr>
                  <th>{t("eq_colNom")}</th>
                  <th>{t("gliv_roster_labelZone")}</th>
                  <th>{t("gliv_colVehicule")}</th>
                  <th>{t("gliv_roster_colConditions")}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {resultats.map((d) => (
                  <tr key={d.id}>
                    <td>{d.user.fullName}</td>
                    <td>{d.zone ?? "—"}</td>
                    <td>{d.vehicleType ? (CLES_VEHICULE_RESEAU[d.vehicleType] ? t(CLES_VEHICULE_RESEAU[d.vehicleType]) : d.vehicleType) : "—"}</td>
                    <td>{d.conditions ?? "—"}</td>
                    <td>
                      <button
                        className={styles.bouton}
                        disabled={demandeEnCours === d.id}
                        onClick={() => demanderAjout(d.id)}
                      >
                        {demandeEnCours === d.id ? t("gliv_roster_demandeEnCours") : t("gliv_roster_boutonDemander")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <h2 className={styles.titre} style={{ marginTop: "48px" }}>
        {t("gliv_roster_titreListe")}
      </h2>
      <p style={{ color: "#555", fontSize: "0.875rem", marginBottom: "24px" }}>
        {t("gliv_roster_noteResponsabilite")}
      </p>

      {chargementAgrees ? (
        <p>{t("gliv_roster_chargementListe")}</p>
      ) : agrees.length === 0 ? (
        <p>{t("gliv_roster_aucunLivreurAgree")}</p>
      ) : (
        <div className={styles.tableauScroll}>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>{t("eq_colNom")}</th>
                <th>{t("gliv_colVehicule")}</th>
                <th>{t("eq_colStatut")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {agrees.map((a) => (
                <tr key={a.id}>
                  <td>{a.driver.user.fullName}</td>
                  <td>
                    {a.driver.vehicleType
                      ? CLES_VEHICULE_RESEAU[a.driver.vehicleType]
                        ? t(CLES_VEHICULE_RESEAU[a.driver.vehicleType])
                        : a.driver.vehicleType
                      : "—"}
                  </td>
                  <td>{t(CLES_STATUT_ACCES[a.status] ?? "gliv_roster_statutEnAttente")}</td>
                  <td>
                    {(a.status === "PENDING" || a.status === "ACTIVE") && (
                      <button
                        className={styles.retirer}
                        disabled={revocationEnCours === a.id}
                        onClick={() => revoquerAcces(a.id)}
                      >
                        {revocationEnCours === a.id ? t("gliv_roster_revocationEnCours") : t("gliv_roster_boutonRevoquer")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
