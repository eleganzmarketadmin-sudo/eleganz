import * as crypto from "crypto";

/**
 * Signature du paramètre `state` du flux OAuth (27 nov. 2026, ELEGANZ BOOST
 * 360°) — nécessaire car la redirection de retour du réseau publicitaire
 * (Meta/TikTok/Google/X) n'est accompagnée d'aucun jeton d'authentification
 * ELEGANZ : `state` doit donc porter lui-même, de façon infalsifiable,
 * quelle boutique et quel canal ont initié la connexion. HMAC-SHA256 avec
 * un secret dédié (BOOST_EXTERNE_OAUTH_STATE_SECRET), secours sur
 * JWT_SECRET si absent — jamais de JWT complet ici, une simple signature
 * suffit pour un usage aussi court (10 minutes).
 */
interface EtatOAuth {
  shopId: string;
  canal: string;
  nonce: string;
  exp: number; // epoch ms
}

const DUREE_VALIDITE_MS = 10 * 60 * 1000;

function cleSecrete(): string {
  return (
    process.env.BOOST_EXTERNE_OAUTH_STATE_SECRET ||
    process.env.JWT_SECRET ||
    "dev-secret-boost-externe-non-securise"
  );
}

export function signerEtatOAuth(shopId: string, canal: string): string {
  const etat: EtatOAuth = {
    shopId,
    canal,
    nonce: crypto.randomBytes(8).toString("hex"),
    exp: Date.now() + DUREE_VALIDITE_MS,
  };
  const payload = Buffer.from(JSON.stringify(etat)).toString("base64url");
  const signature = crypto.createHmac("sha256", cleSecrete()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifierEtatOAuth(state: string): EtatOAuth {
  const [payload, signature] = (state ?? "").split(".");
  if (!payload || !signature) {
    throw new Error("État OAuth invalide — relancez la connexion depuis votre espace Gestion.");
  }
  const attendu = crypto.createHmac("sha256", cleSecrete()).update(payload).digest("base64url");
  const bufSignature = Buffer.from(signature);
  const bufAttendu = Buffer.from(attendu);
  if (bufSignature.length !== bufAttendu.length || !crypto.timingSafeEqual(bufSignature, bufAttendu)) {
    throw new Error("État OAuth invalide — relancez la connexion depuis votre espace Gestion.");
  }
  let etat: EtatOAuth;
  try {
    etat = JSON.parse(Buffer.from(payload, "base64url").toString()) as EtatOAuth;
  } catch {
    throw new Error("État OAuth invalide — relancez la connexion depuis votre espace Gestion.");
  }
  if (etat.exp < Date.now()) {
    throw new Error("Session de connexion expirée — relancez la connexion depuis votre espace Gestion.");
  }
  return etat;
}
