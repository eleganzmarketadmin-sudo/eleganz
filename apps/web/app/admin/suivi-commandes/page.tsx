"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "../AdminShell";
import { api, ApiError } from "../../lib/api";
import { StatusTag } from "../../components/StatusTag";
import { useLocale } from "../../lib/i18n/LocaleContext";
import styles from "./page.module.css";

interface CommandeEnCours {
  id: string;
  boutique: string;
  acheteur: string;
  statut: string;
  statutLabel: string;
  livreur: string | null;
  creeLe: string;
  depuisLe: string;
  heuresDansStatut: number;
  seuilHeures: number | null;
  enRetard: boolean;
  attentionImmediate: boolean;
}

interface ComportementBoutique {
  boutiqueId: string;
  boutique: string;
  totalCommandes: number;
  tauxAnnulationPct: number;
  tauxLitigePct: number;
  delaiMoyenAcceptationHeures: number | null;
}

interface ComportementLivreur {
  livreurId: string;
  nom: string;
  verifie: boolean;
  totalLivraisons: number;
  livrees: number;
  tauxLitigePct: number;
  delaiMoyenLivraisonHeures: number | null;
}

function formaterDuree(heures: number, t: (cle: string) => string): string {
  if (heures < 1) return `${Math.round(heures * 60)} ${t("admsuivi_uniteMin")}`;
  if (heures < 48) return `${heures.toFixed(1)} ${t("admsuivi_uniteHeure")}`;
  return `${Math.round(heures / 24)} ${t("admsuivi_uniteJour")}`;
}

function SuiviCommandesContent() {
  const { t } = useLocale();
  const [commandes, setCommandes] = useState<CommandeEnCours[] | null>(null);
  const [boutiques, setBoutiques] = useState<ComportementBoutique[] | null>(null);
  const [livreurs, setLivreurs] = useState<ComportementLivreur[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<CommandeEnCours[]>("/admin/supervision/commandes-en-cours"),
      api.get<ComportementBoutique[]>("/admin/supervision/boutiques"),
      api.get<ComportementLivreur[]>("/admin/supervision/livreurs"),
    ])
      .then(([c, b, l]) => {
        setCommandes(c);
        setBoutiques(b);
        setLivreurs(l);
      })
      .catch((err) => setErreur(err instanceof ApiError ? err.message : t("admsuivi_chargementImpossible")))
      .finally(() => setChargement(false));
  }, [t]);

  const nombreEnRetard = commandes?.filter((c) => c.enRetard).length ?? 0;

  return (
    <div>
      <h1 className={styles.titre}>{t("admsuivi_titre")}</h1>
      <p className={styles.sousTitre}>{t("admsuivi_sousTitre")}</p>

      {erreur && <div className={styles.erreur}>{erreur}</div>}
      {chargement && <p>{t("commun_chargement")}</p>}

      {commandes && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>
            {t("admsuivi_commandesEnCours")} ({commandes.length})
            {nombreEnRetard > 0 && (
              <span className={styles.compteurRetard}>{nombreEnRetard} {t("admsuivi_enRetardOuATraiter")}</span>
            )}
          </h2>
          {commandes.length === 0 ? (
            <p className={styles.vide}>{t("admsuivi_aucuneCommandeActive")}</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>{t("admsuivi_colBoutique")}</th>
                    <th>{t("gcmd_acheteurFallback")}</th>
                    <th>{t("rfi_colStatut")}</th>
                    <th>{t("gcmd_livreurLabel")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colTempsEtape")}</th>
                  </tr>
                </thead>
                <tbody>
                  {commandes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.boutique}</td>
                      <td>{c.acheteur}</td>
                      <td>
                        <StatusTag
                          label={c.statutLabel}
                          humeur={c.attentionImmediate ? "alerte" : c.enRetard ? "attente" : "neutre"}
                        />
                      </td>
                      <td>{c.livreur ?? "—"}</td>
                      <td className={styles.colChiffre}>
                        {formaterDuree(c.heuresDansStatut, t)}
                        {c.seuilHeures !== null && (
                          <span className={styles.seuil}> / {t("admsuivi_seuil")} {formaterDuree(c.seuilHeures, t)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {boutiques && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>{t("admsuivi_comportementBoutiques")}</h2>
          {boutiques.length === 0 ? (
            <p className={styles.vide}>{t("admsuivi_aucuneCommandeMarketplace")}</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>{t("admsuivi_colBoutique")}</th>
                    <th className={styles.colChiffre}>{t("nav_commandes")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colTauxAnnulation")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colTauxLitige")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colDelaiAcceptation")}</th>
                  </tr>
                </thead>
                <tbody>
                  {boutiques.map((b) => (
                    <tr key={b.boutiqueId}>
                      <td>{b.boutique}</td>
                      <td className={styles.colChiffre}>{b.totalCommandes}</td>
                      <td className={styles.colChiffre}>{b.tauxAnnulationPct}%</td>
                      <td className={styles.colChiffre}>{b.tauxLitigePct}%</td>
                      <td className={styles.colChiffre}>
                        {b.delaiMoyenAcceptationHeures !== null
                          ? formaterDuree(b.delaiMoyenAcceptationHeures, t)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className={styles.note}>{t("admsuivi_noteDelaiAcceptation")}</p>
        </section>
      )}

      {livreurs && (
        <section className={styles.section}>
          <h2 className={styles.titreSection}>{t("admsuivi_comportementLivreurs")}</h2>
          {livreurs.length === 0 ? (
            <p className={styles.vide}>{t("admsuivi_aucuneLivraisonAssignee")}</p>
          ) : (
            <div className={styles.tableauScroll}>
              <table className={styles.tableau}>
                <thead>
                  <tr>
                    <th>{t("gcmd_livreurLabel")}</th>
                    <th>{t("admsuivi_colVerifie")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colLivraisonsAssignees")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colLivrees")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colTauxLitige")}</th>
                    <th className={styles.colChiffre}>{t("admsuivi_colDelaiLivraison")}</th>
                  </tr>
                </thead>
                <tbody>
                  {livreurs.map((l) => (
                    <tr key={l.livreurId}>
                      <td>{l.nom}</td>
                      <td>
                        <StatusTag label={l.verifie ? t("admsuivi_verifie") : t("admsuivi_nonVerifie")} humeur={l.verifie ? "paye" : "neutre"} />
                      </td>
                      <td className={styles.colChiffre}>{l.totalLivraisons}</td>
                      <td className={styles.colChiffre}>{l.livrees}</td>
                      <td className={styles.colChiffre}>{l.tauxLitigePct}%</td>
                      <td className={styles.colChiffre}>
                        {l.delaiMoyenLivraisonHeures !== null
                          ? formaterDuree(l.delaiMoyenLivraisonHeures, t)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default function SuiviCommandesPage() {
  return (
    <AdminShell>
      <SuiviCommandesContent />
    </AdminShell>
  );
}
