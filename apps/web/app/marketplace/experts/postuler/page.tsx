"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// "Postuler comme expert" est la même action que gérer son propre profil
// expert (le formulaire crée la candidature s'il n'en existe pas encore) —
// cette page ne fait que rediriger vers /marketplace/experts/moi pour que
// le lien "Devenir expert" affiché dans l'annuaire public garde une URL
// intuitive et distincte.
export default function PostulerExpertPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/marketplace/experts/moi");
  }, [router]);
  return null;
}
