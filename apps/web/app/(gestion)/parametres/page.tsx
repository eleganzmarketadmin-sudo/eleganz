"use client";

import { useEffect, useState } from "react";
import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { useShop } from "../../lib/shop-context";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface ShopDetails {
  id: string;
  name: string;
  invoiceAddress?: string | null;
  invoicePhone?: string | null;
  invoiceLogoUrl?: string | null;
  invoiceFooterNote?: string | null;
}

function ParametresContent() {
  const { currentShop } = useShop();
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const [adresse, setAdresse] = useState("");
  const [telephone, setTelephone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [noteBasPage, setNoteBasPage] = useState("");

  useEffect(() => {
    if (!currentShop) return;
    setChargement(true);
    setErreur(null);
    api
      .get<ShopDetails>(`/shops/${currentShop.id}`)
      .then((shop) => {
        setAdresse(shop.invoiceAddress ?? "");
        setTelephone(shop.invoicePhone ?? "");
        setLogoUrl(shop.invoiceLogoUrl ?? "");
        setNoteBasPage(shop.invoiceFooterNote ?? "");
      })
      .catch((err) =>
        setErreur(
          err instanceof Error ? err.message : "Impossible de charger les paramètres de la boutique.",
        ),
      )
      .finally(() => setChargement(false));
  }, [currentShop]);

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!currentShop) return;
    setEnregistrement(true);
    setErreur(null);
    setConfirmation(null);
    try {
      await api.patch(`/shops/${currentShop.id}/invoice-settings`, {
        invoiceAddress: adresse,
        invoicePhone: telephone,
        invoiceLogoUrl: logoUrl,
        invoiceFooterNote: noteBasPage,
      });
      setConfirmation("Paramètres enregistrés — vos prochains documents imprimés utiliseront ces informations.");
    } catch (err) {
      setErreur(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer ces paramètres pour le moment.",
      );
    } finally {
      setEnregistrement(false);
    }
  }

  if (chargement) return <p>Chargement des paramètres…</p>;

  return (
    <div>
      <h1 className={styles.titre}>Paramètres</h1>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>Identité sur vos documents</h2>
        <p className={styles.note}>
          Ces informations apparaissent sur vos tickets, factures et bons de livraison imprimés
          (en plus du nom de la boutique et de la mention ELEGANZ Marketplace, affichée sur tous
          les documents). Laissez un champ vide pour ne rien afficher.
        </p>

        {erreur && <div className={styles.erreur}>{erreur}</div>}
        {confirmation && <div className={styles.confirmation}>{confirmation}</div>}

        <form className={styles.formulaire} onSubmit={enregistrer}>
          <div className={styles.champ}>
            <label htmlFor="adresse">Adresse</label>
            <input
              id="adresse"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              placeholder="Ex. 12 Avenue du Commerce, Gombe, Kinshasa"
              maxLength={200}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="telephone">Téléphone affiché</label>
            <input
              id="telephone"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="Ex. +243 81 234 5678"
              maxLength={50}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="logoUrl">Logo (URL d&apos;une image, https://…)</label>
            <input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
              maxLength={500}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="noteBasPage">Note de bas de document (optionnel)</label>
            <textarea
              id="noteBasPage"
              value={noteBasPage}
              onChange={(e) => setNoteBasPage(e.target.value)}
              rows={2}
              placeholder="Ex. Merci pour votre achat ! Échange possible sous 7 jours."
              maxLength={300}
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enregistrement}>
            {enregistrement ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function ParametresPage() {
  return (
    <ProtectedGestionPage>
      <ParametresContent />
    </ProtectedGestionPage>
  );
}
