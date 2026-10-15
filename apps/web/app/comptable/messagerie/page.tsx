"use client";

import { ComptableShell } from "../ComptableShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";

export default function MessagerieComptablePage() {
  return (
    <ComptableShell>
      <h1>Messagerie</h1>
      <MessagerieEcran />
    </ComptableShell>
  );
}
