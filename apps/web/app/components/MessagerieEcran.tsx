"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { api, ApiError } from "../lib/api";
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

function nomAutrePartie(conv: Conversation, monId: string): string {
  const autres = conv.participants.filter((p) => p.user.id !== monId);
  return autres.map((p) => p.user.fullName).join(", ") || "Conversation";
}

/**
 * Centre de messagerie interne (demande UX du 15 oct. 2026, point 4) —
 * composant partagé par tous les espaces (admin, Gestion, Secourable,
 * Marketplace, Livreur) : seule la coquille qui l'entoure change, pas la
 * logique. Fondation volontairement simple : pas encore d'annuaire de
 * contacts (le champ "destinataire" ci-dessous attend un identifiant de
 * compte) — les conversations venant des notifications automatiques
 * (nouvelle commande, etc.) restent le point d'entrée principal pour
 * l'instant.
 */
export function MessagerieEcran({ compact = false }: { compact?: boolean } = {}) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageApercu[] | null>(null);
  const [brouillon, setBrouillon] = useState("");
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const [nouveauDestinataire, setNouveauDestinataire] = useState("");
  const [nouveauMessage, setNouveauMessage] = useState("");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  async function chargerConversations() {
    try {
      const liste = await api.get<Conversation[]>("/messagerie/conversations");
      setConversations(liste);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger la messagerie.");
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
      setErreur(err instanceof ApiError ? err.message : "Impossible de charger les messages.");
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
      setErreur(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setEnvoiEnCours(false);
    }
  }

  async function demarrerConversation() {
    if (!nouveauDestinataire.trim() || !nouveauMessage.trim()) return;
    setEnvoiEnCours(true);
    try {
      const conv = await api.post<Conversation>("/messagerie/conversations", {
        destinataireId: nouveauDestinataire.trim(),
        message: nouveauMessage.trim(),
      });
      setNouveauDestinataire("");
      setNouveauMessage("");
      setFormulaireOuvert(false);
      await chargerConversations();
      ouvrirConversation(conv.id);
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Impossible de démarrer la conversation.");
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
            + Nouvelle conversation
          </button>
          {formulaireOuvert && (
            <div className={styles.formulaireNouveau}>
              <input
                placeholder="Identifiant du destinataire"
                value={nouveauDestinataire}
                onChange={(e) => setNouveauDestinataire(e.target.value)}
              />
              <textarea
                placeholder="Votre message"
                value={nouveauMessage}
                onChange={(e) => setNouveauMessage(e.target.value)}
              />
              <button type="button" onClick={demarrerConversation} disabled={envoiEnCours}>
                Envoyer
              </button>
            </div>
          )}
          {conversations === null && <p className={styles.chargement}>Chargement…</p>}
          {conversations?.length === 0 && <p className={styles.vide}>Aucune conversation pour l&apos;instant.</p>}
          {conversations?.map((conv) => (
            <button
              key={conv.id}
              type="button"
              className={`${styles.itemConversation} ${selectionId === conv.id ? styles.itemActif : ""}`}
              onClick={() => ouvrirConversation(conv.id)}
            >
              <span className={styles.itemNom}>{nomAutrePartie(conv, user.id)}</span>
              {conv.messages[0] && <span className={styles.itemApercu}>{conv.messages[0].body}</span>}
            </button>
          ))}
        </div>
        <div className={styles.colonneThread}>
          {!selectionId && <p className={styles.vide}>Choisissez une conversation à gauche.</p>}
          {selectionId && (
            <>
              <div className={styles.listeMessages}>
                {messages === null && <p className={styles.chargement}>Chargement…</p>}
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
                  placeholder="Écrire une réponse…"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      envoyerReponse();
                    }
                  }}
                />
                <button type="button" onClick={envoyerReponse} disabled={envoiEnCours || !brouillon.trim()}>
                  Envoyer
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
