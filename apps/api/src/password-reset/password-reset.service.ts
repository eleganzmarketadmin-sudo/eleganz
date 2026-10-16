import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { EmailSenderService } from "./email-sender.service";
import { WhatsAppSenderService } from "./whatsapp-sender.service";
import { NotificationType, PasswordResetRequestStatus } from "@eleganz/database";
import { ROLES_ADMIN } from "../admin-team/dto/admin-team.dto";

const TENTATIVES_MAX = 5;
const DUREE_CODE_MINUTES = 15;
const DEMANDES_MAX_PAR_HEURE = 5;

// Masque l'essentiel de l'identifiant avant de le renvoyer au navigateur
// (confirmer où le code a été envoyé sans l'exposer en entier) — ex.
// "j***@gmail.com" ou "+233******89".
function masquerIdentifiant(identifiant: string): string {
  if (identifiant.includes("@")) {
    const [nom, domaine] = identifiant.split("@");
    return `${nom.slice(0, 1)}${"*".repeat(Math.max(nom.length - 1, 1))}@${domaine}`;
  }
  return identifiant.length > 4 ? `${identifiant.slice(0, -4).replace(/./g, "*")}${identifiant.slice(-4)}` : identifiant;
}

const SELECTION_DEMANDE = {
  id: true,
  identifiant: true,
  message: true,
  status: true,
  createdAt: true,
  resolvedAt: true,
  user: { select: { id: true, fullName: true, email: true, phone: true, role: true } },
} as const;

/**
 * Mot de passe oublié (16 oct. 2026, points 1 et "je veux que la réception
 * d'un code par email/WhatsApp soit branché") : auto-service par code quand
 * un fournisseur d'envoi est configuré (RESEND_API_KEY pour l'email,
 * TWILIO_* pour WhatsApp — voir EmailSenderService/WhatsAppSenderService),
 * sinon retombe sur l'escalade admin déjà en place. Jamais les deux à
 * moitié : soit le code part réellement, soit la personne est honnêtement
 * dirigée vers l'administration.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly email: EmailSenderService,
    private readonly whatsapp: WhatsAppSenderService,
  ) {}

  // Toujours la même réponse générique quant à l'existence du compte, qu'un
  // compte corresponde ou non à l'identifiant tapé — même principe que
  // login() dans AuthService : ne jamais laisser deviner si un
  // email/téléphone a un compte ELEGANZ. `canal` dans la réponse dit en
  // revanche honnêtement COMMENT la demande a été traitée (code envoyé ou
  // escalade admin), pour que l'écran sache quelle étape afficher ensuite.
  async demanderReinitialisation(identifiant: string, message?: string) {
    const identifiantNettoye = identifiant.trim();

    // Anti-abus simple : au-delà de quelques demandes pour le même
    // identifiant en une heure, on arrête d'en créer de nouvelles (mais on
    // renvoie quand même une réponse neutre, jamais une erreur qui
    // confirmerait l'existence du compte).
    const demandesRecentes = await this.prisma.passwordResetRequest.count({
      where: { identifiant: identifiantNettoye, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (demandesRecentes >= DEMANDES_MAX_PAR_HEURE) {
      return {
        canal: "ADMIN" as const,
        message: "Trop de demandes récentes pour cet identifiant. Réessayez plus tard ou contactez l'administration.",
      };
    }

    const utilisateur = await this.prisma.user.findFirst({
      where: { OR: [{ email: identifiantNettoye }, { phone: identifiantNettoye }] },
    });

    if (!utilisateur) {
      // Toujours créer une trace, même sans compte trouvé — aide l'admin à
      // repérer un identifiant mal saisi si la personne le signale
      // autrement, sans jamais répondre différemment à l'appelant.
      await this.prisma.passwordResetRequest.create({ data: { identifiant: identifiantNettoye, message } });
      return {
        canal: "ADMIN" as const,
        message:
          "Si un compte correspond à cet identifiant, votre demande a été transmise à l'administration ELEGANZ.",
      };
    }

    // Canal préféré : email si disponible, sinon WhatsApp — évalués dans
    // cet ordre car l'email ne demande aucune action préalable au
    // destinataire, contrairement au bac à sable WhatsApp (voir
    // WhatsAppSenderService).
    const canal: "EMAIL" | "WHATSAPP" | null =
      utilisateur.email && this.email.estConfigure()
        ? "EMAIL"
        : utilisateur.phone && this.whatsapp.estConfigure()
          ? "WHATSAPP"
          : null;

    if (!canal) {
      await this.prisma.passwordResetRequest.create({ data: { identifiant: identifiantNettoye, userId: utilisateur.id, message } });
      const admins = await this.prisma.user.findMany({ where: { role: { in: [...ROLES_ADMIN] } }, select: { id: true } });
      await this.notifications.notifierUtilisateurs(
        admins.map((a) => a.id),
        {
          type: NotificationType.AUTRE,
          title: "Demande de réinitialisation de mot de passe",
          body: `${utilisateur.fullName} (${identifiantNettoye}) a demandé une réinitialisation de mot de passe.`,
          link: "/admin/utilisateurs",
        },
      );
      return {
        canal: "ADMIN" as const,
        message:
          "Votre demande a été transmise à l'administration ELEGANZ. Vous serez contacté·e pour la suite de la réinitialisation.",
      };
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + DUREE_CODE_MINUTES * 60 * 1000);

    const envoye =
      canal === "EMAIL"
        ? await this.email.envoyer(
            utilisateur.email!,
            "Votre code de réinitialisation ELEGANZ",
            `Votre code de réinitialisation est : ${code}\n\nCe code expire dans ${DUREE_CODE_MINUTES} minutes. Si vous n'avez pas demandé cette réinitialisation, ignorez ce message.`,
          )
        : await this.whatsapp.envoyer(
            utilisateur.phone!,
            `ELEGANZ — Votre code de réinitialisation est : ${code}\nCe code expire dans ${DUREE_CODE_MINUTES} minutes.`,
          );

    if (!envoye) {
      // L'envoi a échoué malgré un fournisseur configuré (clé invalide,
      // domaine non vérifié, numéro hors bac à sable…) — retomber sur
      // l'escalade admin plutôt que de laisser la personne attendre un
      // code qui n'arrivera jamais.
      await this.prisma.passwordResetRequest.create({ data: { identifiant: identifiantNettoye, userId: utilisateur.id, message } });
      const admins = await this.prisma.user.findMany({ where: { role: { in: [...ROLES_ADMIN] } }, select: { id: true } });
      await this.notifications.notifierUtilisateurs(
        admins.map((a) => a.id),
        {
          type: NotificationType.AUTRE,
          title: "Demande de réinitialisation de mot de passe (envoi du code échoué)",
          body: `${utilisateur.fullName} (${identifiantNettoye}) — l'envoi du code par ${canal} a échoué, une intervention manuelle est nécessaire.`,
          link: "/admin/utilisateurs",
        },
      );
      return {
        canal: "ADMIN" as const,
        message:
          "Votre demande a été transmise à l'administration ELEGANZ. Vous serez contacté·e pour la suite de la réinitialisation.",
      };
    }

    await this.prisma.passwordResetRequest.create({
      data: {
        identifiant: identifiantNettoye,
        userId: utilisateur.id,
        message,
        codeHash,
        codeExpiresAt: expiresAt,
        codeEnvoyeCanal: canal,
      },
    });

    return {
      canal,
      destinataireMasque: masquerIdentifiant(canal === "EMAIL" ? utilisateur.email! : utilisateur.phone!),
      message: `Un code vous a été envoyé par ${canal === "EMAIL" ? "email" : "WhatsApp"}. Saisissez-le ci-dessous avec votre nouveau mot de passe.`,
    };
  }

  /**
   * Auto-service complet : vérifie le code reçu par email/WhatsApp et
   * change directement le mot de passe, sans passer par un admin.
   * Verrouillage après quelques tentatives ratées (force brute) — la
   * demande est alors rejetée et il faut en refaire une.
   */
  async verifierCode(identifiant: string, code: string, newPassword: string) {
    const identifiantNettoye = identifiant.trim();
    const demande = await this.prisma.passwordResetRequest.findFirst({
      where: { identifiant: identifiantNettoye, status: PasswordResetRequestStatus.PENDING, codeHash: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    // Réponse volontairement générique (jamais "identifiant inconnu" vs
    // "code faux") pour ne pas aider un énumérateur à distinguer les cas.
    const erreurGenerique = () => new BadRequestException("Code invalide ou expiré.");

    if (!demande || !demande.codeHash || !demande.codeExpiresAt) {
      throw erreurGenerique();
    }
    if (demande.codeExpiresAt < new Date()) {
      await this.prisma.passwordResetRequest.update({ where: { id: demande.id }, data: { status: PasswordResetRequestStatus.REJECTED } });
      throw erreurGenerique();
    }
    if (demande.tentativesCode >= TENTATIVES_MAX) {
      await this.prisma.passwordResetRequest.update({ where: { id: demande.id }, data: { status: PasswordResetRequestStatus.REJECTED } });
      throw erreurGenerique();
    }

    const correspond = await bcrypt.compare(code, demande.codeHash);
    if (!correspond) {
      const tentatives = demande.tentativesCode + 1;
      await this.prisma.passwordResetRequest.update({
        where: { id: demande.id },
        data: {
          tentativesCode: tentatives,
          ...(tentatives >= TENTATIVES_MAX ? { status: PasswordResetRequestStatus.REJECTED } : {}),
        },
      });
      throw erreurGenerique();
    }

    if (!demande.userId) {
      throw erreurGenerique();
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: demande.userId }, data: { passwordHash } }),
      this.prisma.passwordResetRequest.update({
        where: { id: demande.id },
        data: { status: PasswordResetRequestStatus.RESOLVED, resolvedAt: new Date() },
      }),
    ]);

    return { message: "Mot de passe réinitialisé. Vous pouvez vous connecter." };
  }

  lister(statusFiltre?: PasswordResetRequestStatus) {
    return this.prisma.passwordResetRequest.findMany({
      where: statusFiltre ? { status: statusFiltre } : undefined,
      select: SELECTION_DEMANDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /**
   * Réinitialise le mot de passe du compte visé par la demande et marque
   * celle-ci résolue. Même logique que AdminUsersService.resetPassword
   * (mot de passe temporaire généré si aucun n'est fourni, jamais stocké
   * en clair) — l'admin doit ensuite communiquer ce mot de passe à la
   * personne par le canal de son choix (téléphone, WhatsApp...), faute de
   * canal automatisé pour l'instant.
   */
  async resoudre(requestId: string, resolvedByUserId: string, newPassword?: string) {
    const demande = await this.prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
    if (!demande) {
      throw new NotFoundException("Demande introuvable.");
    }
    if (demande.status !== PasswordResetRequestStatus.PENDING) {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    if (!demande.userId) {
      throw new ConflictException(
        "Aucun compte ELEGANZ ne correspond à l'identifiant indiqué — vérifiez-le avec la personne avant de réinitialiser.",
      );
    }

    const motDePasse = newPassword ?? crypto.randomBytes(6).toString("base64url");
    const passwordHash = await bcrypt.hash(motDePasse, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: demande.userId }, data: { passwordHash } }),
      this.prisma.passwordResetRequest.update({
        where: { id: requestId },
        data: { status: PasswordResetRequestStatus.RESOLVED, resolvedByUserId, resolvedAt: new Date() },
      }),
    ]);

    return {
      motDePasseTemporaire: newPassword ? undefined : motDePasse,
    };
  }

  async rejeter(requestId: string, resolvedByUserId: string) {
    const demande = await this.prisma.passwordResetRequest.findUnique({ where: { id: requestId } });
    if (!demande) {
      throw new NotFoundException("Demande introuvable.");
    }
    if (demande.status !== PasswordResetRequestStatus.PENDING) {
      throw new ConflictException("Cette demande a déjà été traitée.");
    }
    return this.prisma.passwordResetRequest.update({
      where: { id: requestId },
      data: { status: PasswordResetRequestStatus.REJECTED, resolvedByUserId, resolvedAt: new Date() },
    });
  }
}
