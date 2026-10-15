"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import { nomPays } from "../../lib/i18n/nomPays";
import styles from "./page.module.css";

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
  country: { isoCode: string; name: string };
  city: { name: string };
}

interface Boutique {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  deliveryZones: ZoneLivraison[];
  nombreProduits: number;
  noteMoyenne: number | null;
  nombreAvis: number;
}

export default function BoutiquesPage() {
  const { t } = useLocale();
  const [recherche, setRecherche] = useState("");
  const [requeteActive, setRequeteActive] = useState("");
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Filtre "livre chez moi" — même mécanisme en cascade que sur la page
  // d'accueil Marketplace (apps/web/app/marketplace/page.tsx).
  const [pays, setPays] = useState<Pays[]>([]);
  const [villesDuPaysChoisi, setVillesDuPaysChoisi] = useState<Ville[]>([]);
  const [paysChoisiId, setPaysChoisiId] = useState("");
  const [villeChoisieId, setVilleChoisieId] = useState("");

  useEffect(() => {
    api
      .get<Pays[]>("/geo/pays", false)
      .then(setPays)
      .catch(() => {
        // Non bloquant : sans liste de pays, le filtre par ville reste simplement caché.
      });
  }, []);

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
      .catch(() => {});
    return () => {
      annule = true;
    };
  }, [paysChoisiId]);

  useEffect(() => {
    let annule = false;
    setChargement(true);
    setErreur(null);
    const parametres = new URLSearchParams();
    if (requeteActive) parametres.set("q", requeteActive);
    if (villeChoisieId) parametres.set("cityId", villeChoisieId);
    const chaine = parametres.toString();
    api
      .get<Boutique[]>(`/marketplace/shops${chaine ? `?${chaine}` : ""}`, false)
      .then((data) => {
        if (!annule) setBoutiques(data);
      })
      .catch((err) => {
        if (!annule) setErreur(err instanceof Error ? err.message : t("boutiques_erreur"));
      })
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [requeteActive, villeChoisieId]);

  return (
    <div className={styles.cadre}>
      <div className={styles.entete}>
        <h1>{t("boutiques_titre")}</h1>
        <p>{t("boutiques_sousTitre")}</p>
      </div>

      <form
        className={styles.barreRecherche}
        onSubmit={(e) => {
          e.preventDefault();
          setRequeteActive(recherche);
        }}
      >
        <input
          placeholder={t("boutiques_rechercherPlaceholder")}
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
        <select
          aria-label={t("zonesLivraison_pays")}
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
        <select
          aria-label={t("zonesLivraison_ville")}
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
      </form>

      {chargement ? (
        <p className={styles.messageVide}>{t("boutiques_chargement")}</p>
      ) : erreur ? (
        <p className={styles.messageVide}>{erreur}</p>
      ) : boutiques.length === 0 ? (
        <p className={styles.messageVide}>{t("boutiques_aucuneBoutique")}</p>
      ) : (
        <div className={styles.grille}>
          {boutiques.map((boutique) => (
            <Link className={styles.carte} href={`/marketplace/boutique/${boutique.slug}`} key={boutique.id}>
              {boutique.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={boutique.logoUrl}
                  alt={boutique.name}
                  className={styles.logo}
                  style={{ objectFit: "cover", width: "100%" }}
                />
              ) : (
                <div className={styles.logo}>{boutique.name}</div>
              )}
              <div className={styles.nomBoutique}>{boutique.name}</div>
              <div className={styles.note}>
                {boutique.noteMoyenne !== null
                  ? `★ ${boutique.noteMoyenne.toFixed(1)} (${boutique.nombreAvis})`
                  : t("boutiques_pasEncoreAvis")}
              </div>
              <div className={styles.produitsCount}>
                {t("boutiques_produitsCount").replace("{n}", String(boutique.nombreProduits))}
              </div>
              {boutique.deliveryZones.length > 0 && (
                <div className={styles.zones}>
                  {boutique.deliveryZones
                    .map((zone) => `${nomPays(t, zone.country)} — ${zone.city.name}`)
                    .join(" · ")}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
