import { BadRequestException } from "@nestjs/common";
import type { Granularite, Regroupement } from "./reports.service";

/**
 * Transforme les paramètres de requête (chaînes) en entrées typées pour
 * `ReportsService.genererReleve` — suit le même style que les autres
 * endpoints de l'API qui parsent leurs `@Query()` à la main plutôt que par
 * un DTO dédié (voir pos.controller.ts `dailyDashboard`).
 */
export function parseReleveQuery(query: {
  from?: string;
  to?: string;
  granularite?: string;
  regroupement?: string;
  format?: string;
}) {
  if (!query.from || !query.to) {
    throw new BadRequestException("Les paramètres 'from' et 'to' (dates) sont obligatoires.");
  }
  const from = new Date(query.from);
  const to = new Date(query.to);
  const granularite = (query.granularite ?? "JOUR").toUpperCase() as Granularite;
  const regroupement = query.regroupement ? (query.regroupement.toUpperCase() as Regroupement) : undefined;
  const format = (query.format ?? "json").toLowerCase();
  if (!["json", "xlsx", "pdf"].includes(format)) {
    throw new BadRequestException("Format invalide — json, xlsx ou pdf.");
  }
  return { from, to, granularite, regroupement, format: format as "json" | "xlsx" | "pdf" };
}
