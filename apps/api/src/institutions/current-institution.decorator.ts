import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

// Même principe que CurrentUser (../auth/current-user.decorator.ts) : lit
// `request.institutionId`, posé par InstitutionMembershipGuard une fois
// l'appartenance vérifiée — jamais un id pris ailleurs que ce guard, pour
// qu'un compte ne puisse jamais agir au nom d'une autre institution que la
// sienne.
export const CurrentInstitutionId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { institutionId: string }>();
  return request.institutionId;
});
