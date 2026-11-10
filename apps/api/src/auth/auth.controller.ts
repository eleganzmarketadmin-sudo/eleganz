import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { UpdateMeDto } from "./dto/update-me.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { CurrentUser } from "./current-user.decorator";
import type { AuthenticatedUser } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Limite stricte (20 oct. 2026, audit de lancement) : 10 tentatives par
  // adresse IP toutes les minutes, contre 300 pour le reste de l'API
  // (ThrottlerModule.forRoot dans app.module.ts) — rien ne protégeait
  // auparavant cette route contre un bruteforce automatisé de mots de passe.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMeDto) {
    return this.authService.updateMe(user.id, dto);
  }

  // Même limite que login/register (10/min) : cette route revérifie un mot
  // de passe, donc un bruteforce y a exactement le même intérêt pour un
  // attaquant qui aurait mis la main sur un token encore valide.
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch("me/password")
  @UseGuards(JwtAuthGuard)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
