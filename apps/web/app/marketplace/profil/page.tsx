"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface Address {
  id: string;
  commune: string | null;
  quartier: string | null;
  avenue: string | null;
  repere: string | null;
  isDefault: boolean;
}

interface Compte {
  fullName: string;
  email: string | null;
  phone: string | null;
}

/**
 * Page "Mon profil" de l'acheteur Marketplace (prompt du 15 oct. 2026,
 * point 2) — infos de compte en lecture simple + carnet d'adresses
 * réutilisable (CRUD sur /addresses), pour ne plus ressaisir sa commune/
 * quartier/avenue/repère à chaque commande.
 */
function ProfilContent() {
  const { t } = useLocale();

  const [compte, setCompte] = useState<Compte | null>(null);
  const [adresses, setAdresses] = useState<Address[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    api.get<Compte>("/auth/me").then(setCompte).catch(() => {
      // Non bloquant : sans ces infos, la section "adresses" reste utilisable.
    });
  }, []);

  const [formOuvert, setFormOuvert] = useState(false);
  const [modificationId, setModificationId] = useState<string | null>(null);
  const [commune, setCommune] = useState("");
  const [quartier, setQuartier] = useState("");
  const [avenue, setAvenue] = useState("");
  const [repere, setRepere] = useState("");
  const [parDefaut, setParDefaut] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);

  function recharger() {
    setChargement(true);
    api
      .get<Address[]>("/addresses")
      .then(setAdresses)
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("profil_erreurChargement")))
      .finally(() => setChargement(false));
  }

  useEffect(recharger, []);

  function ouvrirNouvelleAdresse() {
    setModificationId(null);
    setCommune("");
    setQuartier("");
    setAvenue("");
    setRepere("");
    setParDefaut(adresses.length === 0);
    setFormOuvert(true);
  }

  function ouvrirModification(a: Address) {
    setModificationId(a.id);
    setCommune(a.commune ?? "");
    setQuartier(a.quartier ?? "");
    setAvenue(a.avenue ?? "");
    setRepere(a.repere ?? "");
    setParDefaut(a.isDefault);
    setFormOuvert(true);
  }

  async function enregistrerAdresse(e: React.FormEvent) {
    e.preventDefault();
    setEnregistrement(true);
    setErreur(null);
    const payload = {
      commune: commune.trim() || undefined,
      quartier: quartier.trim() || undefined,
      avenue: avenue.trim() || undefined,
      repere: repere.trim() || undefined,
      isDefault: parDefaut,
    };
    try {
      if (modificationId) {
        await api.patch(`/addresses/${modificationId}`, payload);
      } else {
        await api.post("/addresses", payload);
      }
      setFormOuvert(false);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("profil_erreurEnregistrement"));
    } finally {
      setEnregistrement(false);
    }
  }

  async function supprimerAdresse(id: string) {
    setErreur(null);
    try {
      await api.delete(`/addresses/${id}`);
      recharger();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("profil_erreurSuppression"));
    }
  }

  return (
    <div className={styles.cadre}>
      <h1 className={styles.titre}>{t("market_monProfil")}</h1>

      <section className={styles.section}>
        <h2 className={styles.sousTitre}>{t("profil_informationsCompte")}</h2>
        <div className={styles.champLecture}>
          <span className={styles.champLabel}>{t("activites_nom")}</span>
          <span>{compte?.fullName ?? "…"}</span>
        </div>
        {compte?.email && (
          <div className={styles.champLecture}>
            <span className={styles.champLabel}>{t("profil_email")}</span>
            <span>{compte.email}</span>
          </div>
        )}
        {compte?.phone && (
          <div className={styles.champLecture}>
            <span className={styles.champLabel}>{t("profil_telephone")}</span>
            <span>{compte.phone}</span>
          </div>
        )}
      </section>

      <section className={styles.section} id="adresses">
        <div className={styles.enteteSection}>
          <h2 className={styles.sousTitre}>{t("market_mesAdresses")}</h2>
          <button className={styles.boutonSecondaire} onClick={ouvrirNouvelleAdresse}>
            + {t("profil_ajouterAdresse")}
          </button>
        </div>
        <p className={styles.note}>{t("profil_noteAdresses")}</p>

        {erreur && <div className={styles.erreur}>{erreur}</div>}

        {chargement ? (
          <p>{t("commun_chargement")}</p>
        ) : adresses.length === 0 ? (
          <p className={styles.messageVide}>{t("profil_aucuneAdresse")}</p>
        ) : (
          <div className={styles.listeAdresses}>
            {adresses.map((a) => (
              <div className={styles.carteAdresse} key={a.id}>
                <div>
                  {a.isDefault && <span className={styles.badgeDefaut}>{t("profil_adresseParDefaut")}</span>}
                  <div>{[a.avenue, a.quartier, a.commune].filter(Boolean).join(", ") || t("profil_adresseSansDetail")}</div>
                  {a.repere && <div className={styles.note}>{t("livr_repere")} : {a.repere}</div>}
                </div>
                <div className={styles.carteAdresseActions}>
                  <button className={styles.lienAction} onClick={() => ouvrirModification(a)}>
                    {t("profil_modifier")}
                  </button>
                  <button className={styles.lienAction} onClick={() => supprimerAdresse(a.id)}>
                    {t("action_supprimer")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {formOuvert && (
          <form className={styles.formulaire} onSubmit={enregistrerAdresse}>
            <div className={styles.champs}>
              <label className={styles.champ}>
                <span>{t("cmd_labelCommune")}</span>
                <input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder={t("cmd_placeholderCommune")} />
              </label>
              <label className={styles.champ}>
                <span>{t("cmd_labelQuartier")}</span>
                <input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder={t("cmd_placeholderQuartier")} />
              </label>
              <label className={styles.champ}>
                <span>{t("cmd_labelAvenue")}</span>
                <input value={avenue} onChange={(e) => setAvenue(e.target.value)} placeholder={t("cmd_placeholderAvenue")} />
              </label>
              <label className={styles.champ}>
                <span>{t("cmd_labelRepere")}</span>
                <input value={repere} onChange={(e) => setRepere(e.target.value)} placeholder={t("cmd_placeholderRepere")} />
              </label>
            </div>
            <label className={styles.caseParDefaut}>
              <input type="checkbox" checked={parDefaut} onChange={(e) => setParDefaut(e.target.checked)} />
              {t("profil_definirParDefaut")}
            </label>
            <div className={styles.actionsFormulaire}>
              <button className={styles.bouton} type="submit" disabled={enregistrement}>
                {enregistrement ? t("profil_enregistrementEnCours") : t("action_enregistrer")}
              </button>
              <button className={styles.boutonSecondaire} type="button" onClick={() => setFormOuvert(false)}>
                {t("action_annuler")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default function ProfilPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/marketplace/compte?retour=/marketplace/profil");
    }
  }, [loading, user, router]);

  if (loading || !user) return null;

  return <ProfilContent />;
}
