"use client";

import { useEffect, useState } from "react";

interface Props {
  id?: string;
  value: number;
  min?: number;
  onChange: (valeur: number) => void;
  className?: string;
  style?: React.CSSProperties;
  max?: number;
}

/**
 * Champ de quantité numérique "sûr" (12 nov. 2026, signalement : "la
 * modification des quantités au moment de passer la commande sur les
 * téléphones et appli pose problème et renvoi une quantité fixe").
 *
 * Cause du bug : un <input type="number"> dont la `value` est directement
 * le nombre déjà borné (ex. Math.max(1, Math.min(...))) se bloque dès qu'on
 * efface le champ pour retaper un nouveau nombre. Sur mobile en particulier,
 * effacer un champ passe presque toujours par un état intermédiaire vide, et
 * `Number("")` vaut 0 — aussitôt ramené à 1 (ou à l'ancienne valeur) par le
 * bornage, AVANT que l'utilisateur ait pu taper le chiffre suivant. Résultat
 * : le champ semble figé sur une quantité fixe, impossible à changer en
 * tapant (sur ordinateur, une sélection rapide du texte masque souvent ce
 * problème, d'où un signalement propre au mobile/à l'appli).
 *
 * Correctif : un état local (le texte tel quel, y compris vide ou partiel)
 * découplé de la valeur bornée. `onChange` (et donc tout bornage min/max/
 * stock, qui reste de la responsabilité de l'appelant, inchangé) n'est
 * appelé QUE lorsque le texte saisi est un nombre valide — jamais sur l'état
 * intermédiaire vide. Au blur, si le champ est resté vide ou invalide, il se
 * resynchronise sur la dernière valeur valide reçue.
 */
export function ChampQuantite({ id, value, min = 1, max, onChange, className, style }: Props) {
  const [texte, setTexte] = useState(String(value));

  useEffect(() => {
    setTexte(String(value));
  }, [value]);

  return (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      className={className}
      style={style}
      value={texte}
      onChange={(e) => {
        const saisie = e.target.value;
        setTexte(saisie);
        if (saisie.trim() === "") return;
        const nombre = Number(saisie);
        if (!Number.isNaN(nombre)) {
          onChange(nombre);
        }
      }}
      onBlur={() => {
        const nombre = Number(texte);
        if (texte.trim() === "" || Number.isNaN(nombre)) {
          setTexte(String(value));
        }
      }}
    />
  );
}
