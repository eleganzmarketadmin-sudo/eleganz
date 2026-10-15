"use client";

import { ProtectedGestionPage } from "../../components/ProtectedGestionPage";
import { MessagerieEcran } from "../../components/MessagerieEcran";

export default function MessagerieGestionPage() {
  return (
    <ProtectedGestionPage>
      <h1>Messagerie</h1>
      <MessagerieEcran />
    </ProtectedGestionPage>
  );
}
