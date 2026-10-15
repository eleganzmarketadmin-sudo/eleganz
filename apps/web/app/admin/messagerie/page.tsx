"use client";

import { AdminShell } from "../AdminShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";

export default function MessagerieAdminPage() {
  return (
    <AdminShell>
      <h1>Messagerie</h1>
      <MessagerieEcran />
    </AdminShell>
  );
}
