import { Injectable } from "@nestjs/common";
import { BoostCanal } from "@eleganz/database";
import { ReseauPubAdapter } from "./reseau-pub-adapter.interface";
import { MetaAdsAdapter } from "./meta-ads.adapter";
import { TiktokAdsAdapter } from "./tiktok-ads.adapter";
import { GoogleAdsAdapter } from "./google-ads.adapter";
import { XAdsAdapter } from "./x-ads.adapter";

/**
 * Registre des adaptateurs par canal (27 nov. 2026, ELEGANZ BOOST 360°).
 * FACEBOOK et INSTAGRAM partagent le même adaptateur (une seule API Meta) —
 * voir le commentaire d'en-tête de MetaAdsAdapter.
 */
@Injectable()
export class ReseauPubAdapterFactory {
  constructor(
    private readonly meta: MetaAdsAdapter,
    private readonly tiktok: TiktokAdsAdapter,
    private readonly google: GoogleAdsAdapter,
    private readonly x: XAdsAdapter,
  ) {}

  pour(canal: BoostCanal): ReseauPubAdapter {
    switch (canal) {
      case BoostCanal.FACEBOOK:
      case BoostCanal.INSTAGRAM:
        return this.meta;
      case BoostCanal.TIKTOK:
        return this.tiktok;
      case BoostCanal.GOOGLE:
        return this.google;
      case BoostCanal.X:
        return this.x;
      default:
        throw new Error(`Canal publicitaire non pris en charge : ${String(canal)}`);
    }
  }
}
