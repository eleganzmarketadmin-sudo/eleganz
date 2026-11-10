"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/api";
import { useLocale } from "../lib/i18n/LocaleContext";
import styles from "./MessagerieEcran.module.css";

interface Participant {
  user: { id: string; fullName: string };
}

interface MessageApercu {
  id: string;
  body: string;
  createdAt: string;
  sender?: { id: string; fullName: string };
}

interface Conversation {
  id: string;
  subject: string | null;
  updatedAt: string;
  participants: Participant[];
  messages: MessageApercu[];
}

interface ContactUtilisateur {
  id: string;
  fullName: string;
}

interface ContactBoutique {
  id: string;
  name: string;
}

interface ResultatRechercheContacts {
  utilisateurs: ContactUtilisateur[];
  boutiques: ContactBoutique[];
}

type DestinataireChoisi =
  | { type: "utilisateur"; id: string; nom: string }
  | { type: "boutique"; id: string; nom: string };

function nomAutrePartie(conv: Conversation, monId: string, conversationFallback: string): string {
  const autres = conv.participants.filter((p) => p.user.id !== monId);
  return autres.map((p) => p.user.fullName).join(", ") || conversationFallback;
}

/**
 * Centre de messagerie interne (demande UX du 15 oct. 2026, point 4) —
 * composant partagé par tous les espaces (admin, Gestion, Secourable,
 * Marketplace, Livreur) : seule la coquille qui l'entoure change, pas la
 * logique. Fondation volontairement simple : pas encore d'annuaire de
 * contacts complet, mais le champ "destinataire" (demande du 10 nov. 2026)
 * est maintenant une recherche par nom, email ou téléphone (personne) ou
 * nom de boutique — voir MessagingService.rechercherContacts — au lieu
 * d'exiger un UUID interne que personne ne voit jamais à l'écran. Les
 * conversations venant des notifications automatiques (nouvelle commande,
 * etc.) restent un autre point d'entrée courant.
 */
export function MessagerieEcran({ compact = false }: { compact?: boolean } = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageApercu[] | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [rechercheDestinataire, setRechercheDestinataire] = useState("");
  const [resultatsRecherche, setResultatsRecherche] = useState<ResultatRechercheContacts | null>(null);
  const [destinataireChoisi, setDestinataireChoisi] = useState<DestinataireChoisi | null>(null);
  const [nouveauMessage, setNouveauMessage] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  // Recherche de contacts (demande du 10 nov. 2026) — débouncée pour ne pas
  // interroger l'API à chaque frappe ; voir MessagingService.rechercherContacts
  // (minimum 2 caractères côté serveur).
  useEffect(() => {
    if (destinataireChoisi || rechercheDestinataire.trim().length < 2) {
      setResultatsRecherche(null);
      return;
    }
    const minuteur = setTimeout(() => {
      api
        .get<ResultatRechercheContacts>(`/messagerie/contacts/recherche?q=${encodeURIComponent(rechercheDestinataire.trim())}`)
        .then(setResultatsRecherche)
        .catch(() => setResultatsRecherche(null));
    }, 300);
    return () => clearTimeout(minuteur);
  }, [rechercheDestinataire, destinataireChoisi]);

  async function chargerConversations() {
    try {
      const liste = await api.get<Conversation[]>("/messagerie/conversations");
      setConversations(liste);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("msg_impossibleCharger"));
    }
  }

  useEffect(() => {
    chargerConversations();
  }, []);

  async function ouvrirConversation(id: string) {
    setSelectionId(id);
    setMessages(null);
    try {
      const liste = await api.get<MessageApercu[]>(`/messagerie/conversations/${id}/messages`);
      setMessages(liste);
      api.post(`/messagerie/conversations/${id}/lu`).catch(() => {});
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("msg_impossibleChargerMessages"));
    }
  }

  async function envoyerReponse() {
    if (!selectionId || !brouillon.trim()) return;
    setEnvoiEnCours(true);
    try {
      const message = await api.post<MessageApercu>(`/messagerie/conversations/${selectionId}/messages`, {
        body: brouillon.trim(),
      });
      setMessages((liste) => (liste ? [...liste, message] : [message]));
      setBrouillon("");
      chargerConversations();
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("msg_envoiImpossible"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function demarrerConversation() {
    if (!destinataireChoisi || !nouveauMessage.trim()) return;
    setEnvoiEnCours(true);
    try {
      const conv =
        destinataireChoisi.type === "boutique"
          ? await api.post<Conversation>(`/messagerie/conversations/boutique/${destinataireChoisi.id}`, {
              message: nouveauMessage.trim(),
            })
          : await api.post<Conversation>("/messagerie/conversations", {
              destinataireId: destinataireChoisi.id,
              message: nouveauMessage.trim(),
            });
      setRechercheDestinataire("");
      setDestinataireChoisi(null);
      setNouveauMessage("");
      setFormulaireOuvert(false);
      await chargerConversations();
      ouvrirConversation(conv.id);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : t("msg_impossibleDemarrer"));
    } finally {
      setEnvoiEnCours(false);
    }
  }

  if (!user) return null;

  return (
    <div className={styles.cadre}>
      {erreur && <p className={styles.erreur}>{erreur}</p>}
      <div className={`${styles.disposition} ${compact ? styles.dispositionCompacte : ""}`}>
        <div className={styles.colonneListe}>
          <button
            type="button"
            className={styles.boutonNouveau}
            onClick={() => setFormulaireOuvert((v) => !v)}
          >
            + {t("msg_nouvelleConversation")}
          </button>
          {formulaireOuvert && (
            <div className={styles.formulaireNouveau}>
              {destinataireChoisi ? (
                <div className={styles.destinataireChoisi}>
                  <span>{t("msg_destinataireChoisi").replace("{{nom}}", destinataireChoisi.nom)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDestinataireChoisi(null);
                      setRechercheDestinataire("");
                    }}
                  >
                    {t("msg_changerDestinataire")}
                  </button>
                </div>
              ) : (
                <>
                  <input
                    placeholder={t("msg_placeholderDestinataire")}
                    value={rechercheDestinataire}
                    onChange={(e) => setRechercheDestinataire(e.target.value)}
                  />
                  {resultatsRecherche && (
                    <div className={styles.resultatsRecherche}>
                      {resultatsRecherche.utilisateurs.length === 0 && resultatsRecherche.boutiques.length === 0 ? (
                        <p className={styles.vide}>{t("msg_rechercheAucunResultat")}</p>
                      ) : (
                        <>
                          {resultatsRecherche.utilisateurs.length > 0 && (
                            <div>
                              <p className={styles.resultatsGroupeTitre}>{t("msg_rechercheUtilisateurs")}</p>
                              {resultatsRecherche.utilisateurs.map((u) => (
                                <button
                                  key={u.id}
                                  type="button"
                                  className={styles.resultatContact}
                                  onClick={() => setDestinataireChoisi({ type: "utilisateur", id: u.id, nom: u.fullName })}
                                >
                                  {u.fullName}
                                </button>
                              ))}
                            </div>
                          )}
                          {resultatsRecherche.boutiques.length > 0 && (
                            <div>
                              <p className={styles.resultatsGroupeTitre}>{t("msg_rechercheBoutiques")}</p>
                              {resultatsRecherche.boutiques.map((b) => (
                                <button
                                  key={b.id}
                                  type="button"
                                  className={styles.resultatContact}
                                  onClick={() => setDestinataireChoisi({ type: "boutique", id: b.id, nom: b.name })}
                                >
                                  {b.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
              <textarea
                placeholder={t("msg_placeholderMessage")}
                value={nouveauMessage}
                onChange={(e) => setNouveauMessage(e.target.value)}
              />
              <button type="button" onClick={demarrerConversation} disabled={envoiEnCours || !destinataireChoisi}>
                {t("msg_envoyer")}
              </button>
            </div>
          )}
          {conversations === null && <p className={styles.chargement}>{t("commun_chargement")}</p>}
          {conversations?.length === 0 && <p className={styles.vide}>{t("msg_aucuneConversation")}</p>}
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className={`${styles.itemConversation} ${selectionId === conv.id ? styles.itemActif : ""}`}
              onClick={() => ouvrirConversation(conv.id)}
            >
              <span className={styles.itemNom}>{nomAutrePartie(conv, user.id, t("msg_conversationFallback"))}</span>
              {conv.messages[0] && <span className={styles.itemApercu}>{conv.messages[0].body}</span>}
            </button>
          ))}
        </div>
        <div className={styles.colonneThread}>
          {!selectionId && <p className={styles.vide}>{t("msg_choisirConversation")}</p>}
          {selectionId && (
            <>
              <div className={styles.listeMessages}>
                {messages === null && <p className={styles.chargement}>{t("commun_chargement")}</p>}
                {messages?.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.bulle} ${m.sender?.id === user.id ? styles.bulleMoi : styles.bulleAutre}`}
                  >
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <div className={styles.zoneReponse}>
                <textarea
                  value={brouillon}
                  onChange={(e) => setBrouillon(e.target.value)}
                  placeholder={t("msg_placeholderReponse")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      envoyerReponse();
                    }
                  }}
                />
                <button type="button" onClick={envoyerReponse} disabled={envoiEnCours || !brouillon.trim()}>
                  {t("msg_envoyer")}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
