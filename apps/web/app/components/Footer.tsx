"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../lib/api";
import { LogoMark, BandeMarque } from "./Logo";
import styles from "./Footer.module.css";

const TAGLINES: Record<"accueil" | "gestion" | "admin" | "marketplace" | "livreur" | "comptable", string> = {
  accueil: "Une maison, plusieurs pièces : la boutique, la vitrine et la route.",
  gestion: "La caisse et la boutique, tenues au carré.",
  admin: "La plateforme, supervisée en un coup d'œil.",
  marketplace: "La mode congolaise, du tissu au client.",
  livreur: "De l'enlèvement à la remise, mission par mission.",
  comptable: "Mon carnet de gestion au quotidien.",
};

interface CoordonneesPlateforme {
  address: string | null;
  website: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappLink: string | null;
  telegramLink: string | null;
  tiktokUrl: string | null;
  instagramUrl: string | null;
}

/**
 * Pied de page commun aux quatre espaces + Centre de pilotage (demande du
 * 12 oct. 2026 — aucun des sites n'en avait). Étendu le 13 oct. 2026 (points
 * 2 et 3 du prompt du jour) : une colonne "À propos" (qui manquait) et une
 * colonne "Contact" lue depuis les coordonnées officielles gérées dans le
 * Centre de pilotage (`/admin/parametres` → `GET /platform-settings/contact`,
 * public, sans authentification) — jamais une adresse ou un numéro inventés :
 * un champ non configuré est simplement absent de la colonne, jamais vide.
 */
export function Footer({
  variante,
}: {
  variante: "accueil" | "gestion" | "admin" | "marketplace" | "livreur" | "comptable";
}) {
  const [contact, setContact] = useState<CoordonneesPlateforme | null>(null);

  useEffect(() => {
    let annule = false;
    api
      .get<CoordonneesPlateforme>("/platform-settings/contact", false)
      .then((d) => {
        if (!annule) setContact(d);
      })
      .catch(() => {
        // Non bloquant : sans coordonnées disponibles, la colonne contact
        // ne s'affiche simplement pas.
      });
    return () => {
      annule = true;
    };
  }, []);

  const aDesCoordonnees =
    contact &&
    (contact.address ||
      contact.website ||
      contact.supportEmail ||
      contact.supportPhone ||
      contact.whatsappLink ||
      contact.telegramLink ||
      contact.tiktokUrl ||
      contact.instagramUrl);

  return (
    <footer className={styles.pied}>
      <BandeMarque />
      <div className={styles.contenu}>
        <div className={styles.bloc}>
          <div className={styles.marque}>
            <LogoMark size={22} />
            <span>ELEGANZ</span>
          </div>
          <p className={styles.slogan}>{TAGLINES[variante]}</p>
        </div>

        <div className={styles.bloc}>
          <p className={styles.titreColonne}>À propos d&apos;ELEGANZ</p>
          <p className={styles.texteColonne}>
            Un écosystème congolais pour commerçants et indépendants : le carnet
            de gestion Mon Comptable, la caisse et le stock de Gestion, la
            marketplace Market pour vendre en ligne, et le réseau de livreurs
            Livreur — quatre outils, une seule maison.
          </p>
          <Link href="/a-propos">En savoir plus</Link>
        </div>

        <nav className={styles.liens} aria-label="Autres espaces ELEGANZ">
          <Link href="/">Accueil</Link>
          <Link href="/marketplace">ELEGANZ Market</Link>
          <Link href="/connexion">ELEGANZ Gestion</Link>
          <Link href="/livreur/connexion">ELEGANZ Livreur</Link>
          <Link href="/comptable">ELEGANZ Mon Comptable</Link>
          <Link href="/admin/connexion">Centre de pilotage</Link>
          <Link href="/a-propos">À propos</Link>
        </nav>

        {aDesCoordonnees && (
          <div className={styles.bloc}>
            <p className={styles.titreColonne}>Contact</p>
            <ul className={styles.liensContact}>
              {contact!.address && <li>{contact!.address}</li>}
              {contact!.supportPhone && <li>{contact!.supportPhone}</li>}
              {contact!.supportEmail && (
                <li>
                  <a href={`mailto:${contact!.supportEmail}`}>{contact!.supportEmail}</a>
                </li>
              )}
              {contact!.website && (
                <li>
                  <a href={contact!.website} target="_blank" rel="noopener noreferrer">
                    {contact!.website.replace(/^https?:\/\//, "")}
                  </a>
                </li>
              )}
              {contact!.whatsappLink && (
                <li>
                  <a href={contact!.whatsappLink} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                </li>
              )}
              {contact!.telegramLink && (
                <li>
                  <a href={contact!.telegramLink} target="_blank" rel="noopener noreferrer">
                    Telegram
                  </a>
                </li>
              )}
              {contact!.instagramUrl && (
                <li>
                  <a href={contact!.instagramUrl} target="_blank" rel="noopener noreferrer">
                    Instagram
                  </a>
                </li>
              )}
              {contact!.tiktokUrl && (
                <li>
                  <a href={contact!.tiktokUrl} target="_blank" rel="noopener noreferrer">
                    TikTok
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        <p className={styles.copyright}>
          © {new Date().getFullYear()} ELEGANZ — République démocratique du Congo.
        </p>
      </div>
    </footer>
  );
}
