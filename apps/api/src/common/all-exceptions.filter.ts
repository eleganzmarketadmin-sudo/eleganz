import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Filtre d'exceptions global (10 nov. 2026, incident "Internal server error"
 * muet sur l'import du catalogue Excel) — avant ce filtre, l'application
 * n'en avait AUCUN : toute erreur imprévue (c'est-à-dire tout ce qui n'est
 * pas une HttpException volontairement levée par notre propre code, comme
 * BadRequestException/ForbiddenException/NotFoundException) retombait sur le
 * gestionnaire par défaut de Nest, qui renvoie `{"message":"Internal server
 * error"}` sans aucun détail, ni au navigateur (normal, pour ne rien
 * divulguer) ni au serveur (anormal : même nous n'avions alors aucune trace
 * de CE qui avait échoué ni où). Ce filtre ne change rien au comportement
 * des erreurs métier déjà gérées (même statut, même message, renvoyés tels
 * quels) ; il ajoute seulement, pour le reste, un log serveur complet
 * (classe de l'erreur, message technique, route, pile d'appel) et un message
 * client légèrement plus honnête — sans jamais exposer de détail technique
 * interne, même principe que ProductImportService.messagePublicErreurImport.
 */
@Catch()
export class ToutesExceptionsFiltre implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionNonGeree");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    const nomErreur = exception instanceof Error ? exception.constructor.name : typeof exception;
    const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
    this.logger.error(`[${nomErreur}] ${request.method} ${request.originalUrl} — ${detail}`);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        "Une erreur technique inattendue est survenue. Réessayez dans un instant ; si cela persiste, contactez le support ELEGANZ en précisant l'action effectuée.",
    });
  }
}
