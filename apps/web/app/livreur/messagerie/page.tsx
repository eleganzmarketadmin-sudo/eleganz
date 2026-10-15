"use client";

import { LivreurShell } from "../LivreurShell";
import { MessagerieEcran } from "../../components/MessagerieEcran";

export default function MessagerieLivreurPage() {
  return (
    <LivreurShell>
      <h1>Messagerie</h1>
      <MessagerieEcran />
    </LivreurShell>
  );
}
