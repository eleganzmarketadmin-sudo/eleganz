import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

/**
 * Stockage objet des images produits (Cloudflare R2 — compatible API S3,
 * voir docs/MAINTENANCE.md). On ne fait jamais transiter le fichier par
 * notre propre serveur : le navigateur de la boutique envoie l'image
 * directement à R2 via une URL signée à durée limitée (upload direct,
 * pas de goulot d'étranglement côté API, fonctionne même avec de gros
 * fichiers sur une connexion lente).
 */
@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;
  private readonly publicBaseUrl: string | undefined;

  constructor(private readonly config: ConfigService) {
    const accountId = this.config.get<string>("R2_ACCOUNT_ID");
    const accessKeyId = this.config.get<string>("R2_ACCESS_KEY_ID");
    const secretAccessKey = this.config.get<string>("R2_SECRET_ACCESS_KEY");
    this.bucket = this.config.get<string>("R2_BUCKET");
    this.publicBaseUrl = this.config.get<string>("R2_PUBLIC_BASE_URL");

    // Configuration absente (hors production, ou pas encore branchée) :
    // le client reste `null` et toute tentative d'upload échoue avec un
    // message clair plutôt qu'un plantage obscur plus loin.
    this.client =
      accountId && accessKeyId && secretAccessKey
        ? new S3Client({
            region: "auto",
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: { accessKeyId, secretAccessKey },
          })
        : null;
  }

  /**
   * Génère une URL signée valable 5 minutes pour un upload direct (PUT) vers
   * R2, et l'URL publique définitive sous laquelle le fichier sera ensuite
   * accessible. La clé objet est toujours préfixée par la boutique et
   * l'article (`shops/<shopId>/products/<productId>/...`) — jamais devinable
   * ni partagée entre boutiques.
   */
  async creerUrlUploadImage(
    shopId: string,
    productId: string,
    contentType: string,
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.client || !this.bucket || !this.publicBaseUrl) {
      throw new InternalServerErrorException(
        "Le stockage d'images n'est pas encore configuré sur ce serveur (variables R2_* manquantes).",
      );
    }

    const extension = extensionPourType(contentType);
    const key = `shops/${shopId}/products/${productId}/${randomUUID()}${extension}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;

    return { uploadUrl, publicUrl };
  }

  /**
   * Même principe que `creerUrlUploadImage`, généralisé à n'importe quel
   * préfixe de clé (module Experts, 16 oct. 2026, point 3 : photo de
   * profil, CV, diplômes, certifications). `prefix` est fourni par
   * l'appelant et doit déjà être sûr (jamais construit depuis une entrée
   * utilisateur non validée) — ex. `experts/<userId>/documents`.
   */
  async creerUrlUpload(prefix: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
    if (!this.client || !this.bucket || !this.publicBaseUrl) {
      throw new InternalServerErrorException(
        "Le stockage de fichiers n'est pas encore configuré sur ce serveur (variables R2_* manquantes).",
      );
    }

    const extension = extensionPourType(contentType);
    const key = `${prefix}/${randomUUID()}${extension}`;

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 300 },
    );

    const publicUrl = `${this.publicBaseUrl.replace(/\/$/, "")}/${key}`;

    return { uploadUrl, publicUrl };
  }
}

function extensionPourType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "application/pdf":
      return ".pdf";
    case "image/jpeg":
    default:
      return ".jpg";
  }
}
