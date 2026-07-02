import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { Controller } from "../../Controller";
import { GameView } from "../../view";

/**
 * In-game ad shell, kept as a no-op so the `<in-game-promo>` element in
 * index.html still resolves and the HUD controller registry still finds a
 * `Controller`. All ad networks (Playwire RAMP in-game ads, CrazyGames
 * bottom-left banner) have been removed from the site; this component now
 * renders nothing and its `tick()`/`hideAd()` are harmless no-ops.
 */
@customElement("in-game-promo")
export class InGamePromo extends LitElement implements Controller {
  public game: GameView;

  createRenderRoot() {
    return this;
  }

  init() {}

  tick() {}

  public hideAd(): void {}

  render() {
    return html``;
  }
}
