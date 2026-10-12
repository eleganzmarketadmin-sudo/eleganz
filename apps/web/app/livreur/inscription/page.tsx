"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { api, ApiError } from "../../lib/api";
import styles from "./page.module.css";

interface TarificationLivreur {
  driverOpeningFee: string;
  driverMonthlyFee: string;
  driverFreeMonths: number;
}

const COMMUNES = [
  "Gombe",
  "Kalamu",
  "Kinshasa",
  "Kintambo",
  "Lemba",
  "Limete",
  "Matete",
  "Ndjili",
  "Ngaba",
  "Ngaliema",
  "Ngiri-Ngiri",
  "Barumbu",
  "Autre",
];

const VEHICULES: { valeur: string; label: string; documentsRequis: boolean }[] = [
  { valeur: "PIED", label: "À pied", documentsRequis: false },
  { valeur: "VELO", label: "Vélo", documentsRequis: false },
  { valeur: "MOTO", label: "Moto", documentsRequis: true },
  { valeur: "VOITURE", label: "Voiture", documentsRequis: true },
];

export default function InscriptionLivreurPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [zone, setZone] = useState(COMMUNES[0]);
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [vehicleType, setVehicleType] = useState("MOTO");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [tarification, setTarification] = useState<TarificationLivreur | null>(null);

  useEffect(() => {
    api
      .get<TarificationLivreur>("/platform-settings/driver-pricing", false)
      .then(setTarification)
      .catch(() => setTarification(null));
  }, []);

  const vehiculeChoisi = VEHICULES.find((v) => v.valeur === vehicleType);
  const documentsVehiculeRequis = vehiculeChoisi?.documentsRequis ?? false;

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (motDePasse.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (documentsVehiculeRequis && (!vehiclePlate.trim() || !licenseNumber.trim())) {
      setErreur("La plaque d'immatriculation et le numéro de permis sont obligatoires pour ce véhicule.");
      return;
    }
    setEnCours(true);
    try {
      await register({ fullName, identifiant, motDePasse, role: "DRIVER" });
      await api.post("/delivery/drivers/register", {
        zone,
        phone,
        whatsapp: whatsapp.trim() || undefined,
        address,
        vehicleType,
        vehiclePlate: documentsVehiculeRequis ? vehiclePlate.trim() : undefined,
        licenseNumber: documentsVehiculeRequis ? licenseNumber.trim() : undefined,
        idDocumentNumber,
      });
      router.push("/livreur/profil");
    } catch (err) {
      setErreur(err instanceof ApiError ? err.message : "Inscription impossible pour le moment.");
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className={styles.cadre}>
      <div className={styles.panneauMarque}>
        <h1>Devenez livreur ELEGANZ</h1>
        <p>
          Recevez des missions de livraison pour les boutiques ELEGANZ de
          votre zone. Votre compte est examiné par l&apos;administration avant
          de recevoir vos premières missions.
        </p>
        {tarification && (
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            Souscription : {tarification.driverOpeningFee} $ à l&apos;ouverture puis{" "}
            {tarification.driverMonthlyFee} $/mois — {tarification.driverFreeMonths} mois offerts dès la
            validation de votre dossier par l&apos;administration.
          </p>
        )}
      </div>
      <div className={styles.panneauForm}>
        <form className={styles.form} onSubmit={soumettre}>
          <h2 style={{ marginBottom: "24px" }}>Créer mon compte livreur</h2>
          {erreur && <div className={styles.erreur}>{erreur}</div>}
          <div className={styles.champ}>
            <label htmlFor="fullName">Nom complet</label>
            <input
              id="fullName"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="identifiant">Email ou numéro de téléphone</label>
            <input
              id="identifiant"
              type="text"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="zone">Commune où vous livrez principalement</label>
            <select id="zone" value={zone} onChange={(e) => setZone(e.target.value)}>
              {COMMUNES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.champ}>
            <label htmlFor="phone">Numéro de téléphone (contact livraison)</label>
            <input
              id="phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="whatsapp">Numéro WhatsApp (optionnel, si différent)</label>
            <input
              id="whatsapp"
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="address">Adresse</label>
            <input
              id="address"
              type="text"
              autoComplete="street-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="vehicleType">Moyen de livraison</label>
            <select id="vehicleType" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
              {VEHICULES.map((v) => (
                <option key={v.valeur} value={v.valeur}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          {documentsVehiculeRequis && (
            <>
              <div className={styles.champ}>
                <label htmlFor="vehiclePlate">Plaque d&apos;immatriculation</label>
                <input
                  id="vehiclePlate"
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  required
                />
              </div>
              <div className={styles.champ}>
                <label htmlFor="licenseNumber">Numéro de permis de conduire</label>
                <input
                  id="licenseNumber"
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  required
                />
              </div>
            </>
          )}
          <div className={styles.champ}>
            <label htmlFor="idDocumentNumber">Numéro de pièce d&apos;identité (carte d&apos;électeur, CNI, passeport)</label>
            <input
              id="idDocumentNumber"
              type="text"
              value={idDocumentNumber}
              onChange={(e) => setIdDocumentNumber(e.target.value)}
              required
            />
          </div>
          <div className={styles.champ}>
            <label htmlFor="motDePasse">Mot de passe (8 caractères minimum)</label>
            <input
              id="motDePasse"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              required
            />
          </div>
          <button className={styles.bouton} type="submit" disabled={enCours}>
            {enCours ? "Création du compte…" : "Créer mon compte"}
          </button>
          <p style={{ marginTop: "16px", fontSize: "0.875rem" }}>
            Déjà un compte ? <Link href="/livreur/connexion">Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
