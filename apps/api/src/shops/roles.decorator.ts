import { SetMetadata } from "@nestjs/common";
import { StaffRole } from "@eleganz/database";

export const SHOP_ROLES_KEY = "shopRoles";

// Restreint une route à certains rôles de staff (OWNER, MANAGER, CASHIER, ...).
// À utiliser avec ShopMembershipGuard, qui lit cette métadonnée après avoir
// vérifié l'appartenance à la boutique.
export const ShopRoles = (...roles: StaffRole[]) => SetMetadata(SHOP_ROLES_KEY, roles);
