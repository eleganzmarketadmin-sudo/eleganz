"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import { nomPays } from "../lib/i18n/nomPays";
import styles from "./ZonesLivraison.module.css";

interface Pays {
  id: string;
  isoCode: string;
  name: string;
}

interface Ville {
  id: string;
  name: string;
}

interface ZoneLivraison {
  id: string;
  country: Pays;
  city: Ville;
}

/**
 * Zones de livraison d'une boutique (prompt du 15 oct. 2026 : "faciliter
 * les acheteurs et les vendeurs" en rattachant au vendeur les lieux où il
 * peut livrer). Deux menus déroulants en cascade (pays puis ville, jamais
 * de saisie libre) + liste des zones déjà ajoutées, retirables une à une.
 * Pré-sélectionne la RDC par défaut (majorité des vendeurs ELEGANZ) tant
 * qu'aucune zone n'a encore été choisie.
 */
export function ZonesLivraison({ shopId }: { shopId: string }) {
  const { t } = useLocale();
  const [pays, setPays] = useState<Pays[]>([]);
  const [zones, setZones] = useState<ZoneLivraison[]>([]);
  const [villesDuPaysChoisi, setVillesDuPaysChoisi] = useState<Ville[]>([]);
  const [paysChoisiId, setPaysChoisiId] = useState("");
  const [villeChoisieId, setVilleChoisieId] = useState("");
  const [chargement, setChargement] = useState(true);
  const [ajoutEnCours, setAjoutEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    Promise.all([
      api.get<Pays[]>("/geo/pays", false),
      api.get<ZoneLivraison[]>(`/shops/${shopId}/delivery-zones`),
    ])
      .then(([listePays, listeZones]) => {
        if (annule) return;
        setPays(listePays);
        setZones(listeZones);
        // RDC proposée par défaut tant que le vendeur n'a encore rien choisi.
        const rdc = listePays.find((p) => p.isoCode === "CD");
        if (rdc) setPaysChoisiId(rdc.id);
      })
      .catch((err) =>
        setErreur(err instanceof Error ? err.message : "Impossible de charger les zones de livraison."),
      )
      .finally(() => !annule && setChargement(false));
    return () => {
      annule = true;
    };
  }, [shopId]);

  useEffect(() => {
    if (!paysChoisiId) {
      setVillesDuPaysChoisi([]);
      return;
    }
    let annule = false;
    api
      .get<Ville[]>(`/geo/pays/${paysChoisiId}/villes`, false)
      .then((villes) => {
        if (!annule) {
          setVillesDuPaysChoisi(villes);
          setVilleChoisieId("");
        }
      })
      .catch(() => {
        // Non bloquant : le menu ville reste simplement vide.
      });
    return () => {
      annule = true;
    };
  }, [paysChoisiId]);

  async function ajouterZone() {
    if (!villeChoisieId) return;
    setAjoutEnCours(true);
    setErreur(null);
    try {
      const zone = await api.post<ZoneLivraison>(`/shops/${shopId}/delivery-zones`, {
        cityId: villeChoisieId,
      });
      setZones((z) => (z.some((existante) => existante.id === zone.id) ? z : [...z, zone]));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible d'ajouter cette zone pour le moment.");
    } finally {
      setAjoutEnCours(false);
    }
  }

  async function retirerZone(zoneId: string) {
    setErreur(null);
    try {
      await api.delete(`/shops/${shopId}/delivery-zones/${zoneId}`);
      setZones((z) => z.filter((zone) => zone.id !== zoneId));
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de retirer cette zone pour le moment.");
    }
  }

  if (chargement) return null;

  return (
    <div>
      {erreur && <div className={styles.erreur}>{erreur}</div>}

      <div className={styles.liste}>
        {zones.length === 0 && <p className={styles.aucune}>{t("zonesLivraison_aucune")}</p>}
        {zones.map((zone) => (
          <div key={zone.id} className={styles.zone}>
            <span className={styles.zoneLibelle}>
              {nomPays(t, zone.country)} — {zone.city.name}
            </span>
            <button className={styles.zoneRetirer} onClick={() => retirerZone(zone.id)} type="button">
              {t("zonesLivraison_retirer")}
            </button>
          </div>
        ))}
      </div>

      <div className={styles.formulaireAjout}>
        <div className={styles.champSelect}>
          <label htmlFor="zonesLivraisonPays">{t("zonesLivraison_pays")}</label>
          <select
            id="zonesLivraisonPays"
            value={paysChoisiId}
            onChange={(e) => setPaysChoisiId(e.target.value)}
          >
            <option value="">{t("zonesLivraison_choisirPays")}</option>
            {pays.map((p) => (
              <option key={p.id} value={p.id}>
                {nomPays(t, p)}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.champSelect}>
          <label htmlFor="zonesLivraisonVille">{t("zonesLivraison_ville")}</label>
          <select
            id="zonesLivraisonVille"
            value={villeChoisieId}
            onChange={(e) => setVilleChoisieId(e.target.value)}
            disabled={!paysChoisiId}
          >
            <option value="">{t("zonesLivraison_choisirVille")}</option>
            {villesDuPaysChoisi.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className={styles.boutonAjouter}
          type="button"
          onClick={ajouterZone}
          disabled={!villeChoisieId || ajoutEnCours}
        >
          {t("zonesLivraison_ajouter")}
        </button>
      </div>
    </div>
  );
}
