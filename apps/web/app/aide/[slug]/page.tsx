"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { LogoMark } from "../../components/Logo";
import { ApiError, api } from "../../lib/api";
import styles from "./page.module.css";

interface GuidePublic {
  titre: string;
  contenuClient: string;
  imagesClient: string[];
}

/**
 * Page publique de partage d'une fiche du Centre d'aide interne (10 nov.
 * 2026) — jamais d'authentification : un agent ELEGANZ transmet ce lien à
 * un client pour l'accompagner sur une fonctionnalité. Ne reçoit du
 * serveur QUE le contenu "client" (GuidesService.obtenirPartagePublic) —
 * jamais l'explication interne de la fiche, même si ce code en avait
 * besoin, l'API ne la renvoie tout simplement pas ici.
 */
export default function AidePubliquePage() {
  const params = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<GuidePublic | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    api
      .get<GuidePublic>(`/guides/public/${params.slug}`, false)
      .then(setGuide)
      .catch((err) =>
        setErreur(
          err instanceof ApiError && err.statusCode === 404
            ? "Ce lien n'est plus disponible. Demandez un nouveau lien à votre interlocuteur ELEGANZ."
            : "Impossible de charger ce guide pour le moment. Réessayez dans un instant.",
        ),
      )
      .finally(() => setChargement(false));
  }, [params.slug]);

  return (
    <div className={styles.page}>
      <header className={styles.entete}>
        <LogoMark size={28} />
        <span>ELEGANZ</span>
      </header>

      <main className={styles.contenu}>
        {chargement && <p>Chargement…</p>}
        {erreur && <p className={styles.erreur}>{erreur}</p>}
        {guide && (
          <>
            <h1 className={styles.titre}>{guide.titre}</h1>
            <p className={styles.corps}>{guide.contenuClient}</p>
            {guide.imagesClient.length > 0 && (
              <div className={styles.galerie}>
                {guide.imagesClient.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="" />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
