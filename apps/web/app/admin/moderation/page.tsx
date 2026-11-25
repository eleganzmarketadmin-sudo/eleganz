"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { formatDate } from "../../lib/money";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Signalement {
  id: string;
  status: "OUVERT" | "TRAITE" | "IGNORE";
  motDetecte: string;
  champ: string;
  valeurSaisie: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  shop: { id: string; name: string; slug: string; status: string };
}

interface TermeInterdit {
  id: string;
  term: string;
  createdAt: string;
}

/**
 * Écran admin du contrôle anti-blanchiment/produits illicites (24 nov.
 * 2026, retour propriétaire) — voir le commentaire sur ShopModerationFlag
 * dans schema.prisma. Deux sections : les signalements remontés
 * automatiquement par CatalogService quand une création/modification
 * d'article a été bloquée, et la liste de termes interdits elle-même
 * (modifiable ici sans redéploiement).
 */
function ModerationContent() {
  const { t } = useLocale();
  const [signalements, setSignalements] = useState<Signalement[]>([]);
  const [termes, setTermes] = useState<TermeInterdit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [enCours, setEnCours] = useState<string | null>(null);
  const [nouveauTerme, setNouveauTerme] = useState("");
  const [afficherTraites, setAfficherTraites] = useState(false);

  function recharger() {
    Promise.all([
      api.get<Signalement[]>(afficherTraites ? "/admin/moderation/signalements" : "/admin/moderation/signalements?status=OUVERT"),
      api.get<TermeInterdit[]>("/admin/moderation/termes"),
    ])
      .then(([s, te]) => {
        setSignalements(s);
        setTermes(te);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("cpt_erreur")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, [afficherTraites]);

  async function resoudre(flagId: string, status: "TRAITE" | "IGNORE") {
    setEnCours(flagId);
    try {
      await api.patch(`/admin/moderation/signalements/${flagId}`, { status, note: notes[flagId] });
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admmoderation_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function ajouterTerme() {
    const valeur = nouveauTerme.trim();
    if (!valeur) return;
    setEnCours("__nouveau-terme__");
    try {
      const liste = await api.post<TermeInterdit[]>("/admin/moderation/termes", { term: valeur });
      setTermes(liste);
      setNouveauTerme("");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admmoderation_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  async function supprimerTerme(termId: string) {
    setEnCours(termId);
    try {
      const liste = await api.delete<TermeInterdit[]>(`/admin/moderation/termes/${termId}`);
      setTermes(liste);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("admmoderation_actionImpossible"));
    } finally {
      setEnCours(null);
    }
  }

  if (chargement) return <p>{t("commun_chargement")}</p>;

  return (
    <div>
      <h1 className={styles.titre}>{t("admmoderation_titre")}</h1>
      <p className={styles.introduction}>{t("admmoderation_introduction")}</p>
      {erreur && <p>{erreur}</p>}

      <div className={styles.entete}>
        <h2 className={styles.sousTitre}>{t("admmoderation_signalementsTitre")}</h2>
        <label className={styles.caseAfficher}>
          <input type="checkbox" checked={afficherTraites} onChange={(e) => setAfficherTraites(e.target.checked)} />
          {t("admmoderation_afficherTraites")}
        </label>
      </div>

      {signalements.length === 0 ? (
        <p className={styles.messageVide}>{t("admmoderation_aucunSignalement")}</p>
      ) : (
        signalements.map((s) => (
          <div className={styles.signalement} key={s.id}>
            <div className={styles.ligneEntete}>
              <span>
                {s.shop.name} <span className={styles.boutiqueStatut}>({s.shop.status})</span>
              </span>
              <span>{formatDate(s.createdAt)}</span>
            </div>
            <p className={styles.detail}>
              {t("admmoderation_champ")} <strong>{s.champ}</strong> — {t("admmoderation_termeDetecte")}{" "}
              <strong>"{s.motDetecte}"</strong>
            </p>
            <p className={styles.valeurSaisie}>{s.valeurSaisie}</p>
            {s.status === "OUVERT" ? (
              <div className={styles.resolution}>
                <input
                  placeholder={t("admmoderation_placeholderNote")}
                  value={notes[s.id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                />
                <button
                  className={styles.boutonIgnorer}
                  disabled={enCours === s.id}
                  onClick={() => resoudre(s.id, "IGNORE")}
                >
                  {t("admmoderation_classerSansSuite")}
                </button>
                <button className={styles.bouton} disabled={enCours === s.id} onClick={() => resoudre(s.id, "TRAITE")}>
                  {t("admmoderation_marquerTraite")}
                </button>
              </div>
            ) : (
              <p className={styles.statutTraite}>
                {t("admmoderation_statutLabel")} {s.status} — {s.resolvedAt && formatDate(s.resolvedAt)}
                {s.resolutionNote ? ` — ${s.resolutionNote}` : ""}
              </p>
            )}
          </div>
        ))
      )}

      <h2 className={styles.sousTitre}>{t("admmoderation_termesTitre")}</h2>
      <p className={styles.introduction}>{t("admmoderation_termesIntroduction")}</p>
      <div className={styles.ajoutTerme}>
        <input
          placeholder={t("admmoderation_placeholderNouveauTerme")}
          value={nouveauTerme}
          onChange={(e) => setNouveauTerme(e.target.value)}
        />
        <button className={styles.bouton} disabled={enCours === "__nouveau-terme__" || !nouveauTerme.trim()} onClick={ajouterTerme}>
          {t("admmoderation_ajouterTerme")}
        </button>
      </div>
      <div className={styles.listeTermes}>
        {termes.map((te) => (
          <span className={styles.puceTerme} key={te.id}>
            {te.term}
            <button
              className={styles.boutonRetirerTerme}
              disabled={enCours === te.id}
              onClick={() => supprimerTerme(te.id)}
              title={t("admmoderation_retirerTerme")}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function AdminModerationPage() {
  return (
    <AdminShell>
      <ModerationContent />
    </AdminShell>
  );
}
