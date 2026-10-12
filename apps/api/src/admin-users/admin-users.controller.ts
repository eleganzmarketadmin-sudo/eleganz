import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { AdminResetPasswordDto } from "./dto/admin-users.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-auth.guard";

function requireAdmin(user: AuthenticatedUser) {
  if (!user.role.startsWith("ADMIN_")) {
    throw new ForbiddenException("Réservé à l'administration ELEGANZ.");
  }
}

/**
 * Gestion des comptes utilisateurs (acheteurs, vendeurs, staff) depuis le
 * Centre de pilotage — prompt du 12 oct. 2026 : "le Centre de pilotage ne
 * prévoit pas la gestion des utilisateurs (réinitialisation des mots de
 * passe et gestion des autres soucis en tant qu'admin)".
 */
@Controller("admin/users")
@UseGuards(JwtAuthGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query("q") q?: string) {
    requireAdmin(user);
    return this.adminUsersService.search(q);
  }

  @Get(":userId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    requireAdmin(user);
    return this.adminUsersService.findOne(userId);
  }

  @Post(":userId/reset-password")
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("userId") userId: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    requireAdmin(user);
    return this.adminUsersService.resetPassword(userId, dto.newPassword);
  }

  @Post(":userId/suspend")
  suspend(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    requireAdmin(user);
    return this.adminUsersService.setSuspended(userId, true);
  }

  @Post(":userId/reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param("userId") userId: string) {
    requireAdmin(user);
    return this.adminUsersService.setSuspended(userId, false);
  }
}
