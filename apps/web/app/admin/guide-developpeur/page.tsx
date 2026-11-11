"use client";

import { AdminShell } from "../AdminShell";
import styles from "./page.module.css";

/**
 * Guide développeur / architecture (demande du 11 nov. 2026) — page
 * volontairement statique (pas d'appel API, pas d'i18n) : son public est
 * l'IT ou le développeur qui doit reprendre la plateforme, pas l'utilisateur
 * final, et son contenu (des milliers de mots, très technique, en français)
 * n'a pas sa place dans le système de traduction des 9 langues de l'app.
 *
 * Elle ne remplace pas les fichiers `docs/*.md` du dépôt (plus détaillés sur
 * certains sujets : finance, mode hors-ligne, conformité factures, plan
 * commercial) — elle les référence. Son rôle est d'être LE point d'entrée
 * unique, accessible depuis l'application elle-même (donc même sans accès
 * au dépôt Git), qui donne une vue d'ensemble suffisante pour intervenir en
 * urgence, puis oriente vers le bon fichier ou le bon dossier de code pour
 * aller plus loin.
 */
export default function GuideDeveloppeurPage() {
  return (
    <AdminShell>
      <div className={styles.page}>
        <header className={styles.entete}>
          <h1 className={styles.titre}>Guide développeur — architecture ELEGANZ</h1>
          <p className={styles.sousTitre}>
            Document de référence pour toute personne (interne ou prestataire) qui doit
            intervenir sur le code, diagnostiquer une panne, ou reprendre la maintenance de
            la plateforme sans avoir participé à sa construction.
          </p>
          <div className={styles.avis}>
            Cette page est écrite pour un public technique et reste volontairement en
            français uniquement — elle n&apos;est pas traduite dans les autres langues de
            l&apos;application. Elle complète, sans les remplacer, les fichiers Markdown du
            dossier <code className={styles.inline}>docs/</code> à la racine du dépôt
            (voir la section « Pour aller plus loin » en bas de page).
          </div>
        </header>

        <nav className={styles.sommaire} aria-label="Sommaire">
          <h2>Sommaire</h2>
          <ul className={styles.sommaireListe}>
            <li><a href="#vue-ensemble">1. Vue d&apos;ensemble</a></li>
            <li><a href="#produit">2. Ce que fait ELEGANZ</a></li>
            <li><a href="#monorepo">3. Organisation du code</a></li>
            <li><a href="#auth">4. Comptes, espaces et jetons</a></li>
            <li><a href="#api">5. Carte de l&apos;API (back-end)</a></li>
            <li><a href="#web">6. Carte du front-end</a></li>
            <li><a href="#donnees">7. Base de données et stockage</a></li>
            <li><a href="#deploiement">8. Déploiement et environnements</a></li>
            <li><a href="#securite">9. Sécurité</a></li>
            <li><a href="#incidents">10. Incidents connus — à ne pas reproduire</a></li>
            <li><a href="#diagnostic">11. Diagnostiquer une panne</a></li>
            <li><a href="#aller-plus-loin">12. Pour aller plus loin</a></li>
          </ul>
        </nav>

        {/* 1. VUE D'ENSEMBLE ------------------------------------------------ */}
        <section id="vue-ensemble" className={styles.section}>
          <h2>1. Vue d&apos;ensemble</h2>
          <p className={styles.sectionIntro}>
            Les dix secondes qu&apos;il faut avoir en tête avant de toucher au code.
          </p>
          <ul>
            <li><strong>Deux applications</strong> dans un seul dépôt (monorepo pnpm) : une API NestJS (<code className={styles.inline}>apps/api</code>) et un site Next.js (<code className={styles.inline}>apps/web</code>), qui partagent une seule base de données via <code className={styles.inline}>packages/database</code> (schéma Prisma).</li>
            <li><strong>Hébergement</strong> : Railway, deux services distincts — <code className={styles.inline}>eleganz</code> (le site web) et <code className={styles.inline}>eleganz-api</code> (l&apos;API). Chaque <code className={styles.inline}>git push</code> sur la branche principale déclenche un déploiement automatique des deux services.</li>
            <li><strong>Pas de fichiers de migration Prisma</strong> : le schéma est appliqué par <code className={styles.inline}>prisma db push</code> à chaque démarrage de l&apos;API (voir §8). C&apos;est une différence importante avec un projet Prisma « classique ».</li>
            <li><strong>Un seul compte peut avoir accès à plusieurs « espaces »</strong> (Gestion, Marketplace, Mon assistant, Admin, Livreur) selon son rôle — voir §4, c&apos;est la pièce la plus subtile de l&apos;architecture.</li>
            <li><strong>Ce développeur (l&apos;assistant qui a écrit cette page) n&apos;a jamais eu accès</strong> aux identifiants de production, à la base de données réelle, ni au tableau de bord Railway — tout le travail passe par des commits Git et une vérification du statut de déploiement via l&apos;API GitHub. Si vous reprenez la main, c&apos;est probablement la première chose à mettre en place pour vous-même.</li>
          </ul>
        </section>

        {/* 2. PRODUIT -------------------------------------------------------- */}
        <section id="produit" className={styles.section}>
          <h2>2. Ce que fait ELEGANZ</h2>
          <p className={styles.sectionIntro}>
            Comprendre le métier avant le code évite de « corriger » des choix volontaires.
          </p>
          <p>
            ELEGANZ cible les commerçants de Kinshasa (RDC) et propose deux produits sur une
            même base technique :
          </p>
          <div className={styles.grilleCartes}>
            <div className={styles.carte}>
              <h4>ELEGANZ Gestion</h4>
              <p>
                Un outil de caisse / gestion de boutique (POS) : stock, ventes, factures,
                relevés. Fonctionne même en boutique physique sans vente en ligne.
              </p>
            </div>
            <div className={styles.carte}>
              <h4>ELEGANZ Marketplace</h4>
              <p>
                Une place de marché multivendeur publique, où les boutiques en mode
                <code className={styles.inline}> MARKETPLACE</code> ou <code className={styles.inline}>HYBRID</code> exposent leurs produits à la vente en ligne.
              </p>
            </div>
            <div className={styles.carte}>
              <h4>ELEGANZ Mon assistant (« Secourable »)</h4>
              <p>
                Un carnet d&apos;activité / suivi financier personnel, indépendant d&apos;une
                boutique — accessible à tout compte ELEGANZ, pas réservé aux commerçants.
              </p>
            </div>
            <div className={styles.carte}>
              <h4>Trouver un expert</h4>
              <p>
                Un annuaire d&apos;experts (comptables, juristes, etc.) consultables depuis la
                Marketplace.
              </p>
            </div>
          </div>
          <p>
            Le champ <code className={styles.inline}>Shop.mode</code> (<code className={styles.inline}>PRIVATE</code> / <code className={styles.inline}>MARKETPLACE</code> / <code className={styles.inline}>HYBRID</code>) est le
            pivot entre Gestion et Marketplace : une même boutique peut vendre uniquement en
            interne, uniquement en ligne, ou les deux. Une seule table <code className={styles.inline}>StockMovement</code>,
            mise à jour de façon transactionnelle, empêche qu&apos;un même article soit vendu
            deux fois (une fois en caisse, une fois en ligne) — ne jamais créer un deuxième
            chemin de décrément de stock qui contournerait cette table.
          </p>
          <p>
            Le réseau de livreurs propres à la plateforme (<code className={styles.inline}>Driver</code>) est fermé aux
            nouvelles inscriptions publiques depuis le 13 oct. 2026 (décision produit, pas un
            bug) — remplacé opérationnellement par des livreurs gérés par chaque boutique
            elle-même (<code className={styles.inline}>ShopDriver</code>, sans compte propre). Le code de <code className={styles.inline}>Driver</code> est
            conservé intact pour une réactivation future : ne pas le supprimer en pensant
            « nettoyer du code mort ».
          </p>
        </section>

        {/* 3. MONOREPO -------------------------------------------------------- */}
        <section id="monorepo" className={styles.section}>
          <h2>3. Organisation du code</h2>
          <p className={styles.sectionIntro}>
            Monorepo pnpm (<code className={styles.inline}>pnpm@10</code>, Node ≥ 20). Trois paquets principaux.
          </p>
          <pre className={styles.code}>{`eleganz/
├── apps/
│   ├── api/            NestJS — l'API (backend)
│   │   └── src/<35 modules>/   un dossier par domaine métier
│   └── web/            Next.js (App Router) — le site (frontend)
│       └── app/
│           ├── (gestion)/      ELEGANZ Gestion (caisse)
│           ├── admin/          Centre de pilotage (cette page y est)
│           ├── comptable/      Mon assistant / Secourable
│           ├── livreur/        Espace livreur plateforme
│           ├── marketplace/    Marketplace publique + compte acheteur
│           ├── a-propos/ aide/ mot-de-passe-oublie/   pages publiques
│           ├── components/     composants partagés entre espaces
│           └── lib/            client API, auth, i18n, hooks partagés
├── packages/
│   └── database/        schéma Prisma (packages/database/prisma/schema.prisma)
│                         + script de seed admin
├── docs/                 documentation interne (Markdown, voir §12)
└── pnpm-workspace.yaml`}</pre>
          <p>
            Chaque espace applicatif du front (Gestion, Admin, Livreur, Comptable,
            Marketplace) a sa propre « Shell » React (<code className={styles.inline}>GestionShell</code>,{" "}
            <code className={styles.inline}>AdminShell</code>, <code className={styles.inline}>LivreurShell</code>, <code className={styles.inline}>ComptableShell</code>) : son propre en-tête, sa
            propre navigation, et — point important — son propre jeton de connexion (§4).
            Seules les pages vraiment publiques (<code className={styles.inline}>/</code> et <code className={styles.inline}>/a-propos</code>) utilisent{" "}
            <code className={styles.inline}>SiteHeader</code> à la place.
          </p>
          <p>
            <strong>Scripts utiles</strong> (racine du dépôt) :
          </p>
          <pre className={styles.code}>{`pnpm install           # installe tout le monorepo
pnpm dev:api           # lance l'API en local (port 3001 par défaut)
pnpm dev:web           # lance le site en local (Next dev server)
pnpm db:generate       # régénère le client Prisma (nécessite un accès réseau
                       # à binaries.prisma.sh — échoue dans certains
                       # bacs à sable restreints, fonctionne en local/CI réel)`}</pre>
        </section>

        {/* 4. AUTH ------------------------------------------------------------ */}
        <section id="auth" className={styles.section}>
          <h2>4. Comptes, espaces et jetons</h2>
          <p className={styles.sectionIntro}>
            La partie la plus facile à casser par accident si on ne lit que le code sans ce
            résumé.
          </p>
          <p>
            Un compte ELEGANZ (table <code className={styles.inline}>User</code>, un <code className={styles.inline}>role</code> unique) peut avoir accès à
            plusieurs espaces du site selon ce rôle. Chaque espace a sa propre page de
            connexion et <strong>sa propre clé de jeton dans le <code className={styles.inline}>localStorage</code> du
            navigateur</strong> — c&apos;est le mécanisme qui empêche qu&apos;une session ouverte
            dans un espace « déteigne » silencieusement sur un autre.
          </p>
          <table className={styles.tableau}>
            <thead>
              <tr>
                <th>Espace</th>
                <th>Clé localStorage</th>
                <th>Page de connexion</th>
                <th>Rôle requis côté serveur</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Gestion + Marketplace (acheteur)</td>
                <td><code className={styles.inline}>eleganz_token</code></td>
                <td><code className={styles.inline}>/connexion</code> (Gestion) ou <code className={styles.inline}>/marketplace/compte</code></td>
                <td><code className={styles.inline}>SHOP_OWNER</code> / <code className={styles.inline}>SHOP_STAFF</code> pour Gestion ; aucun pour Marketplace acheteur</td>
              </tr>
              <tr>
                <td>Admin (Centre de pilotage)</td>
                <td><code className={styles.inline}>eleganz_admin_token</code></td>
                <td><code className={styles.inline}>/admin/connexion</code></td>
                <td>tout rôle commençant par <code className={styles.inline}>ADMIN_</code></td>
              </tr>
              <tr>
                <td>Livreur plateforme</td>
                <td><code className={styles.inline}>eleganz_livreur_token</code></td>
                <td><code className={styles.inline}>/livreur/connexion</code></td>
                <td><code className={styles.inline}>DRIVER</code></td>
              </tr>
              <tr>
                <td>Mon assistant (Secourable)</td>
                <td><code className={styles.inline}>eleganz_comptable_token</code></td>
                <td><code className={styles.inline}>/comptable/connexion</code></td>
                <td>aucun — tout compte ELEGANZ, par choix de conception (voir plus bas)</td>
              </tr>
            </tbody>
          </table>
          <p>
            Le routage se fait dans <code className={styles.inline}>espaceAuth()</code>, fichier{" "}
            <code className={styles.inline}>apps/web/app/lib/api.ts</code>, selon le préfixe de l&apos;URL. Règle à respecter
            impérativement en ajoutant un nouvel espace ou une nouvelle route : toujours
            vérifier une frontière de segment (<code className={styles.inline}>chemin === &quot;/x&quot; || chemin.startsWith(&quot;/x/&quot;)</code>), jamais un{" "}
            <code className={styles.inline}>startsWith</code> seul — voir l&apos;incident correspondant en §10.
          </p>
          <h3>Pourquoi « Mon assistant » n&apos;a pas de rôle réservé</h3>
          <p>
            C&apos;est volontaire, pas un oubli : n&apos;importe quel compte ELEGANZ (commerçant
            ou pas) peut utiliser Secourable, car c&apos;est un carnet personnel indépendant
            d&apos;une boutique. La vérification se fait néanmoins dans{" "}
            <code className={styles.inline}>AuthService.login</code> (<code className={styles.inline}>apps/api/src/auth/auth.service.ts</code>) via un
            paramètre <code className={styles.inline}>espace</code> envoyé par le front à la connexion — il ne sert pas à
            restreindre l&apos;accès à Secourable, seulement à garantir qu&apos;une connexion déjà
            ouverte dans Gestion ne puisse plus, depuis le 11 nov. 2026, être réutilisée en
            silence dans Secourable sans passer par <code className={styles.inline}>/comptable/connexion</code>.
          </p>
          <h3>Déconnexion automatique après inactivité</h3>
          <p>
            Hook <code className={styles.inline}>useDeconnexionInactivite</code> (<code className={styles.inline}>apps/web/app/lib/useDeconnexionInactivite.ts</code>),
            appelé une seule fois de façon centrale dans <code className={styles.inline}>AuthProvider</code> (<code className={styles.inline}>auth.tsx</code>).
            Seuil par défaut : 2 heures sans activité (clic, clavier, défilement, retour sur
            l&apos;onglet). L&apos;horodatage de dernière activité est écrit dans{" "}
            <code className={styles.inline}>localStorage</code> (une clé par espace), donc la déconnexion s&apos;applique même
            après une fermeture complète du navigateur, pas seulement un onglet laissé ouvert.
          </p>
          <h3>Le jeton lui-même (JWT)</h3>
          <ul>
            <li>Émis par <code className={styles.inline}>AuthService.issueToken</code>, payload minimal : <code className={styles.inline}>{"{ sub: userId, role }"}</code>.</li>
            <li>Durée de vie : 7 jours (<code className={styles.inline}>apps/api/src/auth/auth.module.ts</code>, <code className={styles.inline}>signOptions.expiresIn</code>).</li>
            <li>
              Envoyé en en-tête <code className={styles.inline}>Authorization: Bearer …</code> — jamais en cookie, donc pas
              de CSRF classique, mais pas de révocation serveur instantanée non plus pour un
              jeton déjà émis. C&apos;est pour cette raison que <code className={styles.inline}>JwtAuthGuard</code> relit le
              compte en base à <strong>chaque</strong> requête authentifiée (rôle + <code className={styles.inline}>isSuspended</code>)
              plutôt que de faire confiance au seul contenu du jeton : un compte suspendu ou
              rétrogradé perd l&apos;accès immédiatement, pas seulement à sa prochaine
              connexion. Le coût est une requête base de données supplémentaire par appel —
              décision volontaire du propriétaire après un audit de sécurité (16 oct. 2026),
              à ne pas « optimiser » en revenant au seul contenu du jeton.
            </li>
            <li>
              Création de compte admin : jamais via <code className={styles.inline}>/auth/register</code> (réservé
              acheteur/boutique) — uniquement via le script de seed{" "}
              <code className={styles.inline}>pnpm --filter @eleganz/database seed:admin</code>, qui lit{" "}
              <code className={styles.inline}>ELEGANZ_ADMIN_EMAIL</code> / <code className={styles.inline}>ELEGANZ_ADMIN_PASSWORD</code> (pas de mot de passe
              par défaut codé en dur).
            </li>
          </ul>
          <h3>Permissions fines côté Admin</h3>
          <p>
            Au-delà du rôle <code className={styles.inline}>ADMIN_*</code>, chaque sous-rôle (<code className={styles.inline}>ADMIN_SALES</code>,{" "}
            <code className={styles.inline}>ADMIN_FINANCE</code>, <code className={styles.inline}>ADMIN_OPS</code>, <code className={styles.inline}>ADMIN_LOGISTICS</code>, <code className={styles.inline}>ADMIN_MARKETING</code>,{" "}
            <code className={styles.inline}>ADMIN_SUPPORT</code>, <code className={styles.inline}>ADMIN_AUDITOR</code>, et <code className={styles.inline}>ADMIN_SUPER</code> qui voit tout) a une
            liste d&apos;écrans <code className={styles.inline}>MenuAdmin</code> par défaut, modifiable au cas par cas par un{" "}
            <code className={styles.inline}>ADMIN_SUPER</code> depuis « Équipe admin » (<code className={styles.inline}>adminMenuItemsOverride</code>, calculé
            côté API dans <code className={styles.inline}>admin-team/menu-admin.util.ts</code>). <strong>Rappel essentiel</strong> : ce
            menu ne filtre que la navigation affichée — la vraie barrière de sécurité doit
            exister dans chaque contrôleur API correspondant (vérification de rôle côté
            service), jamais seulement côté écran. C&apos;est une exigence explicite du
            propriétaire, répétée dans plusieurs décisions passées.
          </p>
        </section>

        {/* 5. API -------------------------------------------------------------- */}
        <section id="api" className={styles.section}>
          <h2>5. Carte de l&apos;API (back-end)</h2>
          <p className={styles.sectionIntro}>
            NestJS, un module par dossier sous <code className={styles.inline}>apps/api/src/</code>. Nom de dossier =
            nom du module Nest dans la grande majorité des cas.
          </p>
          <table className={styles.tableau}>
            <thead><tr><th>Module</th><th>Rôle (à vérifier dans le contrôleur pour le détail exact)</th></tr></thead>
            <tbody>
              <tr><td>auth</td><td>Connexion, inscription, profil, jeton JWT, garde d&apos;authentification — voir §4.</td></tr>
              <tr><td>shops</td><td>Boutiques (création, mode PRIVATE/MARKETPLACE/HYBRID, membres).</td></tr>
              <tr><td>catalog</td><td>Produits, variantes, catégories.</td></tr>
              <tr><td>pos</td><td>Caisse / point de vente ELEGANZ Gestion.</td></tr>
              <tr><td>orders</td><td>Commandes acheteur et <code className={styles.inline}>ShopOrder</code> (éclatement multivendeur).</td></tr>
              <tr><td>marketplace</td><td>Logique propre à la place de marché publique.</td></tr>
              <tr><td>delivery</td><td>Livraison — coordination avec <code className={styles.inline}>Driver</code>/<code className={styles.inline}>ShopDriver</code> (voir §2).</td></tr>
              <tr><td>disputes</td><td>Litiges entre acheteur/boutique/plateforme.</td></tr>
              <tr><td>reviews</td><td>Avis clients.</td></tr>
              <tr><td>reports</td><td>Signalements (contenu, comportement).</td></tr>
              <tr><td>messaging</td><td>Messagerie interne (voir <code className={styles.inline}>ChatWidget</code> côté front).</td></tr>
              <tr><td>notifications</td><td>Notifications in-app (voir <code className={styles.inline}>NotificationBell</code> côté front).</td></tr>
              <tr><td>push</td><td>Notifications push (navigateur/mobile).</td></tr>
              <tr><td>comptable</td><td>« Mon assistant » / Secourable — carnet d&apos;activité, agenda.</td></tr>
              <tr><td>echeancier</td><td>Échéances / plans de paiement (à confirmer dans le contrôleur).</td></tr>
              <tr><td>finance</td><td>Module Finance (Phase 1, 13 oct. 2026) — s&apos;appuie sur les tables existantes, pas encore de vraie comptabilité en partie double.</td></tr>
              <tr><td>billing</td><td>Facturation / abonnements plateforme.</td></tr>
              <tr><td>documents</td><td>Génération de documents (factures, relevés — voir dépendances <code className={styles.inline}>docx</code>/<code className={styles.inline}>pdfkit</code>/<code className={styles.inline}>exceljs</code>/<code className={styles.inline}>pptxgenjs</code>).</td></tr>
              <tr><td>ai-credits</td><td>Crédits d&apos;usage d&apos;IA (quota, consommation).</td></tr>
              <tr><td>experts</td><td>Annuaire « Trouver un expert ».</td></tr>
              <tr><td>guides</td><td>Fiches du Centre d&apos;aide (voir <code className={styles.inline}>admin/centre-aide</code> côté front).</td></tr>
              <tr><td>admin-cockpit</td><td>Tableau de bord / pilotage admin (chiffres agrégés).</td></tr>
              <tr><td>admin-settings</td><td>Paramètres plateforme (réservés <code className={styles.inline}>ADMIN_SUPER</code>).</td></tr>
              <tr><td>admin-team</td><td>Gestion des comptes admin et de leurs permissions (<code className={styles.inline}>MenuAdmin</code>) — voir §4.</td></tr>
              <tr><td>admin-users</td><td>Gestion des comptes utilisateurs (suspension, etc.).</td></tr>
              <tr><td>operations</td><td>Opérations internes diverses (à confirmer dans le contrôleur).</td></tr>
              <tr><td>supervision</td><td>Supervision technique / monitoring interne.</td></tr>
              <tr><td>geo</td><td>Géolocalisation / zones de livraison.</td></tr>
              <tr><td>addresses</td><td>Adresses des comptes.</td></tr>
              <tr><td>import-export</td><td>Import/export de données (catalogue, stock…).</td></tr>
              <tr><td>storage</td><td>Upload de fichiers vers Cloudflare R2 — voir §7.</td></tr>
              <tr><td>password-reset</td><td>Réinitialisation de mot de passe.</td></tr>
              <tr><td>cron</td><td>Tâches planifiées (<code className={styles.inline}>@nestjs/schedule</code>).</td></tr>
              <tr><td>prisma</td><td><code className={styles.inline}>PrismaService</code> partagé — point d&apos;accès unique à la base de données.</td></tr>
              <tr><td>common</td><td>Utilitaires partagés entre modules (filtres, décorateurs…).</td></tr>
            </tbody>
          </table>
          <p>
            <strong>Piège structurel à connaître</strong> : Nest instancie tous les
            fournisseurs de tous les modules au démarrage. Si un module utilise{" "}
            <code className={styles.inline}>@UseGuards(JwtAuthGuard)</code> sans importer <code className={styles.inline}>AuthModule</code>, l&apos;API entière
            refuse de démarrer — pas seulement ce module. Voir l&apos;incident détaillé en §10.
          </p>
          <h3>Sécurisation globale (<code className={styles.inline}>apps/api/src/main.ts</code>)</h3>
          <ul>
            <li><code className={styles.inline}>ValidationPipe({"{ whitelist: true, transform: true }"})</code> global — toute propriété non déclarée dans un DTO est rejetée.</li>
            <li>Filtre d&apos;exception global (<code className={styles.inline}>ToutesExceptionsFiltre</code>) — évite qu&apos;une erreur non gérée reste silencieuse.</li>
            <li><code className={styles.inline}>helmet({"{ contentSecurityPolicy: false }"})</code> — CSP volontairement désactivée : l&apos;API ne sert que du JSON et des téléchargements binaires, jamais de HTML.</li>
            <li>CORS restreint via la variable <code className={styles.inline}>CORS_ALLOWED_ORIGINS</code> (liste séparée par des virgules), avec <code className={styles.inline}>https://www.eleganzmarket.com</code> et <code className={styles.inline}>https://eleganzmarket.com</code> par défaut en production, plus localhost hors production.</li>
          </ul>
        </section>

        {/* 6. WEB --------------------------------------------------------------- */}
        <section id="web" className={styles.section}>
          <h2>6. Carte du front-end</h2>
          <p className={styles.sectionIntro}>
            Next.js App Router, composants client (<code className={styles.inline}>&quot;use client&quot;</code>) pour la quasi-totalité
            de l&apos;app — ce n&apos;est pas un site majoritairement statique/SSR.
          </p>
          <table className={styles.tableau}>
            <thead><tr><th>Dossier</th><th>Espace</th></tr></thead>
            <tbody>
              <tr><td><code className={styles.inline}>app/page.tsx</code>, <code className={styles.inline}>app/a-propos</code></td><td>Pages publiques (vitrine), <code className={styles.inline}>SiteHeader</code>.</td></tr>
              <tr><td><code className={styles.inline}>app/(gestion)</code></td><td>ELEGANZ Gestion — protégé par <code className={styles.inline}>ProtectedGestionPage</code> + <code className={styles.inline}>GestionShell</code>.</td></tr>
              <tr><td><code className={styles.inline}>app/marketplace</code></td><td>Marketplace publique + compte acheteur + annuaire experts.</td></tr>
              <tr><td><code className={styles.inline}>app/comptable</code></td><td>Mon assistant / Secourable — <code className={styles.inline}>ComptableShell</code>.</td></tr>
              <tr><td><code className={styles.inline}>app/admin</code></td><td>Centre de pilotage — <code className={styles.inline}>AdminShell</code> (cette page y vit, <code className={styles.inline}>/admin/guide-developpeur</code>).</td></tr>
              <tr><td><code className={styles.inline}>app/livreur</code></td><td>Espace livreur plateforme — <code className={styles.inline}>LivreurShell</code>.</td></tr>
              <tr><td><code className={styles.inline}>app/aide</code>, <code className={styles.inline}>app/mot-de-passe-oublie</code></td><td>Pages d&apos;assistance publiques.</td></tr>
              <tr><td><code className={styles.inline}>app/components</code></td><td>Composants partagés entre espaces (ex. <code className={styles.inline}>NotificationBell</code>, <code className={styles.inline}>ChatWidget</code>, <code className={styles.inline}>Footer</code>, <code className={styles.inline}>Logo</code>).</td></tr>
              <tr><td><code className={styles.inline}>app/lib</code></td><td>Client API (<code className={styles.inline}>api.ts</code>), authentification (<code className={styles.inline}>auth.tsx</code>), i18n, hooks partagés (<code className={styles.inline}>useDeconnexionInactivite</code>, <code className={styles.inline}>useScrollNavActif</code>, synchronisation hors-ligne…).</td></tr>
            </tbody>
          </table>
          <h3>Internationalisation (i18n)</h3>
          <p>
            Toutes les chaînes affichées à l&apos;utilisateur passent par <code className={styles.inline}>t(&quot;clé&quot;)</code>{" "}
            (<code className={styles.inline}>apps/web/app/lib/i18n/</code>), avec 9 locales maintenues dans{" "}
            <code className={styles.inline}>translations.ts</code> (un très gros fichier — chaque clé apparaît une fois par
            locale, dans le même ordre). Ajouter une clé sans l&apos;ajouter dans les 9 blocs
            fait planter l&apos;affichage pour les langues où elle manque. <strong>Cette page de
            guide est l&apos;exception volontaire</strong> : contenu technique interne, jamais
            montré à un client final, donc écrit en français brut sans passer par ce système.
          </p>
          <h3>CSS</h3>
          <p>
            CSS Modules partout (<code className={styles.inline}>*.module.css</code> à côté de chaque composant), pas de
            bibliothèque de composants UI tierce. Jetons de design communs en variables CSS
            (<code className={styles.inline}>--color-ink</code>, <code className={styles.inline}>--color-surface</code>, <code className={styles.inline}>--espace-*</code>, <code className={styles.inline}>--touche-min</code> pour la taille
            minimale tactile, etc.) — voir <code className={styles.inline}>docs/DESIGN_SYSTEM.md</code> pour le détail. Toujours
            vérifier le rendu en-dessous de 560px (seuil utilisé pour les bascules
            <code className={styles.inline}> flex-wrap</code> mobiles) avant de considérer une mise en page terminée.
          </p>
        </section>

        {/* 7. DONNEES ------------------------------------------------------------ */}
        <section id="donnees" className={styles.section}>
          <h2>7. Base de données et stockage</h2>
          <p className={styles.sectionIntro}>
            PostgreSQL via Prisma. Schéma unique : <code className={styles.inline}>packages/database/prisma/schema.prisma</code>.
          </p>
          <ul>
            <li>Pas de dossier <code className={styles.inline}>migrations/</code> — le schéma est appliqué par <code className={styles.inline}>prisma db push</code> (voir §8), pas par des fichiers de migration SQL versionnés.</li>
            <li>
              Commentaires de schéma : toujours en <code className={styles.inline}>// ligne simple</code>, jamais en{" "}
              <code className={styles.inline}>/** style JSDoc */</code> — invalide en Prisma Schema Language, voir
              l&apos;incident en §10.
            </li>
            <li>
              Composite unique avec un champ nullable (<code className={styles.inline}>@@unique([a, b])</code> où <code className={styles.inline}>b</code> est
              optionnel) : accepté par Prisma mais inutilisable pour <code className={styles.inline}>findUnique</code>/<code className={styles.inline}>upsert</code> —
              préférer <code className={styles.inline}>@@index</code> (non-unique) + <code className={styles.inline}>findFirst</code> avec des champs à plat.
            </li>
            <li>
              Objets binaires (images produits, etc.) : Cloudflare R2 (compatible S3), via{" "}
              <code className={styles.inline}>StorageService</code> (<code className={styles.inline}>apps/api/src/storage/</code>). Upload direct
              navigateur → R2 par URL signée (<code className={styles.inline}>POST /shops/:shopId/products/:productId/images/upload-url</code>), jamais relayé par le serveur API. Le bucket R2 doit avoir
              « Public Access » activé, sinon les images retournent 401/403 côté vitrine.
            </li>
          </ul>
        </section>

        {/* 8. DEPLOIEMENT ------------------------------------------------------- */}
        <section id="deploiement" className={styles.section}>
          <h2>8. Déploiement et environnements</h2>
          <p className={styles.sectionIntro}>
            Railway, deux services, déploiement automatique sur chaque push.
          </p>
          <pre className={styles.code}>{`apps/api — script "start" (package.json) :
  prisma db push --accept-data-loss --skip-generate \\
    --schema=../../packages/database/prisma/schema.prisma \\
  && node dist/main.js`}</pre>
          <p>
            Chaque redémarrage Railway de l&apos;API applique donc automatiquement tout
            changement additif du schéma (nouvelle table, nouvelle colonne nullable ou avec
            valeur par défaut). <strong>Ne jamais compter sur <code className={styles.inline}>--accept-data-loss</code></strong> pour
            un changement réellement destructeur (suppression de colonne, passage en{" "}
            <code className={styles.inline}>NOT NULL</code> sur une table déjà peuplée, renommage) — ces cas demandent une
            revue manuelle et une discipline de déploiement en deux temps (schéma d&apos;abord,
            code ensuite, ou l&apos;inverse selon le cas), jamais un seul commit qui fait les
            deux à la fois.
          </p>
          <h3>Variables d&apos;environnement — API (<code className={styles.inline}>apps/api/.env.example</code>)</h3>
          <table className={styles.tableau}>
            <thead><tr><th>Variable</th><th>Rôle</th></tr></thead>
            <tbody>
              <tr><td><code className={styles.inline}>DATABASE_URL</code></td><td>Chaîne de connexion PostgreSQL.</td></tr>
              <tr><td><code className={styles.inline}>JWT_SECRET</code></td><td>Secret de signature des jetons — obligatoire en production, l&apos;API refuse de démarrer sans (voir §9).</td></tr>
              <tr><td><code className={styles.inline}>PORT</code></td><td>Port d&apos;écoute HTTP.</td></tr>
              <tr><td><code className={styles.inline}>R2_ACCOUNT_ID</code>, <code className={styles.inline}>R2_ACCESS_KEY_ID</code>, <code className={styles.inline}>R2_SECRET_ACCESS_KEY</code>, <code className={styles.inline}>R2_BUCKET</code></td><td>Accès Cloudflare R2.</td></tr>
              <tr><td><code className={styles.inline}>R2_PUBLIC_BASE_URL</code></td><td>URL publique de base pour les fichiers R2 (non secrète).</td></tr>
              <tr><td><code className={styles.inline}>ELEGANZ_ADMIN_EMAIL</code>, <code className={styles.inline}>ELEGANZ_ADMIN_PASSWORD</code></td><td>Identifiants du premier compte admin, utilisés uniquement par le script de seed.</td></tr>
              <tr><td><code className={styles.inline}>CORS_ALLOWED_ORIGINS</code></td><td>Liste d&apos;origines autorisées, séparées par des virgules (voir §5).</td></tr>
            </tbody>
          </table>
          <h3>Variables d&apos;environnement — Web</h3>
          <p>
            <code className={styles.inline}>NEXT_PUBLIC_API_URL</code> — URL de base de l&apos;API, lue dans{" "}
            <code className={styles.inline}>apps/web/app/lib/api.ts</code> (retombe sur <code className={styles.inline}>http://localhost:3001</code> en local).
          </p>
          <h3>Vérifier un déploiement sans accès au tableau de bord Railway</h3>
          <p>
            Depuis ce bac à sable, le seul accès fiable à l&apos;état réel du déploiement
            Railway passe par le statut de commit GitHub :
          </p>
          <pre className={styles.code}>{`gh api repos/<owner>/<repo>/commits/<sha>/status \\
  --jq '.statuses[] | "\\(.context)|\\(.state)|\\(.description)"'`}</pre>
          <p>
            Si un déploiement échoue sans message clair, une bissection par{" "}
            <code className={styles.inline}>git checkout &lt;commit-sain&gt; -- &lt;fichiers-suspects&gt;</code> puis nouveau push est la
            méthode pratique pour isoler la cause.
          </p>
        </section>

        {/* 9. SECURITE ----------------------------------------------------------- */}
        <section id="securite" className={styles.section}>
          <h2>9. Sécurité</h2>
          <ul>
            <li><code className={styles.inline}>JWT_SECRET</code> absent : démarrage refusé en production (depuis le 3 nov. 2026, décision explicite après un incident de fuite d&apos;identifiants Railway le 21 oct. 2026) — avant cela, l&apos;API démarrait quand même avec un secret de secours connu de quiconque lit le code source.</li>
            <li>Mots de passe hachés avec <code className={styles.inline}>bcryptjs</code> (jamais stockés ni journalisés en clair).</li>
            <li><code className={styles.inline}>JwtAuthGuard</code> revérifie le rôle et le statut <code className={styles.inline}>isSuspended</code> en base à chaque requête (voir §4) — une suspension ou un changement de rôle prend effet immédiatement, pas seulement à la prochaine connexion.</li>
            <li>Séparation boutique / plateforme imposée au niveau service, jamais seulement au niveau écran — exigence explicite et répétée du propriétaire (voir aussi §4 sur le menu admin).</li>
            <li>CORS restreint par défaut aux domaines ELEGANZ en production (voir §5/§8).</li>
          </ul>
          <div className={styles.incident}>
            <span className={styles.incidentTitre}>Contrainte de ce bac à sable (pas une règle du produit)</span>
            Aucune session de développement n&apos;a jamais entré d&apos;identifiant réel, ouvert
            de connexion Railway CLI, ni accédé directement à la base de données de
            production — tout changement de données réelles passe par du code committé puis
            déployé. Si vous avez besoin d&apos;investiguer des données de production
            directement, cela demande un accès que cet environnement n&apos;a jamais eu.
          </div>
        </section>

        {/* 10. INCIDENTS ---------------------------------------------------------- */}
        <section id="incidents" className={styles.section}>
          <h2>10. Incidents connus — à ne pas reproduire</h2>
          <p className={styles.sectionIntro}>
            Chaque point ci-dessous a coûté un vrai temps de diagnostic lors d&apos;une
            session précédente. Repris en détail dans <code className={styles.inline}>docs/MAINTENANCE.md</code>.
          </p>

          <div className={styles.incident}>
            <span className={styles.incidentTitre}>1. Un module oublie <code className={styles.inline}>AuthModule</code> → toute l&apos;API ne démarre plus</span>
            Tout module utilisant <code className={styles.inline}>@UseGuards(JwtAuthGuard)</code> doit importer{" "}
            <code className={styles.inline}>AuthModule</code> (dont dépend <code className={styles.inline}>JwtAuthGuard</code> via <code className={styles.inline}>JwtService</code>). Nest
            instancie tous les fournisseurs de tous les modules au démarrage : un seul oubli
            fait planter le processus entier, pas seulement le module en cause.
          </div>

          <div className={styles.incident}>
            <span className={styles.incidentTitre}>2. Commentaire Prisma en <code className={styles.inline}>/** */</code> → échec silencieux</span>
            La syntaxe JSDoc est invalide en Prisma Schema Language. Ça fait échouer{" "}
            <code className={styles.inline}>prisma generate</code>/<code className={styles.inline}>db push</code> au démarrage du conteneur — mais Railway
            continue de servir l&apos;ancienne version plutôt que de planter franchement.
            Symptôme typique : les nouvelles routes font une boucle de 404 alors que tout le
            reste fonctionne, ce qui ressemble à un problème de câblage NestJS et égare le
            diagnostic. Toujours utiliser <code className={styles.inline}>//</code>.
          </div>

          <div className={styles.incident}>
            <span className={styles.incidentTitre}>3. <code className={styles.inline}>startsWith</code> sans frontière de segment</span>
            <code className={styles.inline}>espaceAuth().startsWith(&quot;/livreur&quot;)</code> capturait autrefois{" "}
            <code className={styles.inline}>/livreurs</code> (la page Gestion de gestion des livreurs internes à une
            boutique, sans rapport avec l&apos;espace livreur plateforme). Règle : toujours
            vérifier une frontière de segment (<code className={styles.inline}>chemin === &quot;/x&quot; || chemin.startsWith(&quot;/x/&quot;)</code>), et avant de nommer une nouvelle route, chercher les usages existants de{" "}
            <code className={styles.inline}>startsWith(&quot;/&lt;préfixe&gt;&quot;</code> qui pourraient entrer en collision.
          </div>

          <div className={styles.incident}>
            <span className={styles.incidentTitre}>4. <code className={styles.inline}>@@unique</code> avec un champ nullable</span>
            Accepté à la validation/génération du schéma, mais ne produit aucune clé
            composite réellement utilisable pour <code className={styles.inline}>findUnique</code>/<code className={styles.inline}>upsert</code>. Préférer{" "}
            <code className={styles.inline}>@@index</code> (non-unique) + <code className={styles.inline}>findFirst</code> avec des champs à plat.
          </div>

          <div className={styles.incident}>
            <span className={styles.incidentTitre}>5. Limitations propres à ce bac à sable (pas au monde réel)</span>
            <code className={styles.inline}>pnpm db:generate</code> échoue ici (accès réseau à <code className={styles.inline}>binaries.prisma.sh</code> bloqué) ;{" "}
            <code className={styles.inline}>next build</code> échoue aussi ici (<code className={styles.inline}>next/font/google</code> a besoin de{" "}
            <code className={styles.inline}>fonts.googleapis.com</code>, également bloqué). Les deux fonctionnent normalement
            sur Railway ou une machine de développement réelle. Dans ce bac à sable, seule
            une vérification de syntaxe TypeScript (<code className={styles.inline}>tsc</code>/<code className={styles.inline}>esbuild</code>) est possible, jamais
            une vérification de types consciente de Prisma ni une vraie compilation Next.js —
            ne pas confondre un tsc propre avec « ça compile ».
          </div>
        </section>

        {/* 11. DIAGNOSTIC ---------------------------------------------------------- */}
        <section id="diagnostic" className={styles.section}>
          <h2>11. Diagnostiquer une panne — par où commencer</h2>
          <ol>
            <li><strong>Le site répond mais une fonctionnalité précise échoue</strong> : ouvrir la console navigateur (réseau) et regarder le code HTTP retourné par l&apos;API. Un 401 pointe presque toujours vers §4 (mauvais espace/jeton expiré) ; un 403 vers une vérification de rôle côté contrôleur.</li>
            <li><strong>Tout un espace entier ne répond plus (404 en boucle)</strong> : vérifier le statut du dernier déploiement (§8) avant de chercher un bug de code — un schéma Prisma invalide (incident §10.2) laisse tourner l&apos;ancienne version sans crash visible.</li>
            <li><strong>L&apos;API entière est en panne (tous les espaces)</strong> : regarder les logs de démarrage Railway du service <code className={styles.inline}>eleganz-api</code> — un module Nest mal câblé (incident §10.1) ou <code className={styles.inline}>JWT_SECRET</code> manquant en production (§9) empêchent le démarrage complet.</li>
            <li><strong>Des images ne s&apos;affichent pas</strong> : vérifier l&apos;accès public du bucket Cloudflare R2 (§7) avant de suspecter le code d&apos;upload.</li>
            <li><strong>Un utilisateur se plaint d&apos;avoir été déconnecté « tout seul »</strong> : rappeler le seuil d&apos;inactivité de 2 heures (§4) avant de chercher un bug — c&apos;est un comportement voulu depuis le 11 nov. 2026.</li>
          </ol>
        </section>

        {/* 12. ALLER PLUS LOIN ------------------------------------------------------ */}
        <section id="aller-plus-loin" className={styles.section}>
          <h2>12. Pour aller plus loin — fichiers du dépôt</h2>
          <p className={styles.sectionIntro}>
            Cette page donne une vue d&apos;ensemble suffisante pour intervenir. Pour un sujet
            précis, le dossier <code className={styles.inline}>docs/</code> à la racine du dépôt va plus loin — non
            accessible depuis cette interface web, uniquement depuis le code source.
          </p>
          <table className={styles.tableau}>
            <thead><tr><th>Fichier</th><th>Contenu</th></tr></thead>
            <tbody>
              <tr><td><code className={styles.inline}>README.md</code></td><td>Ordre de lecture recommandé pour une prise en main complète.</td></tr>
              <tr><td><code className={styles.inline}>docs/PROJECT_OVERVIEW.md</code></td><td>Ce qu&apos;est ELEGANZ, marché cible, raisons du choix Gestion-puis-Marketplace.</td></tr>
              <tr><td><code className={styles.inline}>docs/DECISIONS.md</code></td><td>Décisions validées par le propriétaire (stack, paiements, budget, portée V1…) et leurs conséquences techniques directes.</td></tr>
              <tr><td><code className={styles.inline}>docs/ARCHITECTURE.md</code></td><td>Choix de stack, principes d&apos;architecture, unicité du stock, contrôle d&apos;accès.</td></tr>
              <tr><td><code className={styles.inline}>docs/ARCHITECTURE_FINANCE.md</code></td><td>Détail du module Finance (le plus long document du dossier).</td></tr>
              <tr><td><code className={styles.inline}>docs/ARCHITECTURE_HORS_LIGNE.md</code></td><td>Mode hors-ligne (saisie différée, synchronisation au retour réseau).</td></tr>
              <tr><td><code className={styles.inline}>docs/DATABASE.md</code></td><td>Modèles de données par domaine, dettes de modélisation connues.</td></tr>
              <tr><td><code className={styles.inline}>docs/MAINTENANCE.md</code></td><td>Détail complet des incidents du §10, commandes utiles, limites du bac à sable.</td></tr>
              <tr><td><code className={styles.inline}>docs/DESIGN_SYSTEM.md</code></td><td>Jetons visuels (couleurs, espacements, typographie).</td></tr>
              <tr><td><code className={styles.inline}>docs/COMPLIANCE_FACTURE_NORMALISEE.md</code></td><td>Conformité des factures générées.</td></tr>
              <tr><td><code className={styles.inline}>docs/PLAN_COMMERCIAL.md</code></td><td>Plan commercial (contexte produit, pas technique).</td></tr>
              <tr><td><code className={styles.inline}>docs/PROJECT_STATUS.md</code>, <code className={styles.inline}>docs/NEXT_ACTIONS.md</code></td><td>État d&apos;avancement et actions suivantes au moment de leur dernière mise à jour.</td></tr>
            </tbody>
          </table>
          <p>
            Cette page elle-même peut être tenue à jour directement dans{" "}
            <code className={styles.inline}>apps/web/app/admin/guide-developpeur/page.tsx</code> — pas de système de
            publication séparé, un simple commit suffit, au même titre que n&apos;importe
            quelle autre page de l&apos;application.
          </p>
          <a href="#vue-ensemble" className={styles.retourHaut}>↑ Retour au sommaire</a>
        </section>
      </div>
    </AdminShell>
  );
}
