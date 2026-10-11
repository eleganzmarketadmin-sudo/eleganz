"use client";

/**
 * File d'opérations hors-ligne (docs/ARCHITECTURE_HORS_LIGNE.md, phase 1).
 * IndexedDB plutôt que localStorage : transactionnel, pas de limite de
 * taille pratique, et ne bloque pas le thread principal sur un gros volume
 * de ventes en attente.
 */

export interface OperationEnAttente {
  clientOperationId: string;
  shopId: string;
  type: "POS_SALE";
  payload: unknown;
  createdAtClient: string;
  tentatives: number;
  dernierEchec?: string;
}

const DB_NAME = "eleganz_hors_ligne";
const STORE = "pending_operations";
const DB_VERSION = 1;

function ouvrirBase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponible dans ce navigateur."));
      return;
    }
    const requete = indexedDB.open(DB_NAME, DB_VERSION);
    requete.onupgradeneeded = () => {
      const db = requete.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientOperationId" });
      }
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

export async function ajouterOperation(op: OperationEnAttente): Promise<void> {
  const db = await ouvrirBase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listerOperationsEnAttente(): Promise<OperationEnAttente[]> {
  const db = await ouvrirBase();
  const resultat = await new Promise<OperationEnAttente[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const requete = tx.objectStore(STORE).getAll();
    requete.onsuccess = () => resolve(requete.result as OperationEnAttente[]);
    requete.onerror = () => reject(requete.error);
  });
  db.close();
  // Ordre FIFO par horodatage client — important pour le stock (voir docs/ARCHITECTURE_HORS_LIGNE.md).
  return resultat.sort((a, b) => a.createdAtClient.localeCompare(b.createdAtClient));
}

export async function retirerOperation(clientOperationId: string): Promise<void> {
  const db = await ouvrirBase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientOperationId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function marquerEchec(clientOperationId: string, op: OperationEnAttente): Promise<void> {
  await ajouterOperation({
    ...op,
    tentatives: op.tentatives + 1,
    dernierEchec: new Date().toISOString(),
  });
}
