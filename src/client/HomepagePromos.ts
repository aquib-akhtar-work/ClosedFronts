import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

/**
 * Ad-display shell, kept as a no-op so the `<homepage-promos>` element in
 * index.html still resolves. All ad networks (Playwire RAMP gutter/bottom-rail
 * ads, corner video ads) have been removed from the site; this component now
 * renders nothing and only retains the listeners it used to wire up so that
 * any external callers of `show()`/`close()` stay safe.
 */
@customElement("homepage-promos")
export class HomepagePromos extends LitElement {
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Ad lifecycle events are no longer relevant, but keep listening so that
    // dispatching them elsewhere does not leak handlers onto a missing element.
    document.addEventListener("userMeResponse", () => {});
    document.addEventListener("join-lobby", () => {});
    document.addEventListener("leave-lobby", () => {});
  }

  public show(): void {}

  public close(): void {}

  public loadBottomRail(): void {}

  public destroyBottomRail(): void {}

  render() {
    return html``;
  }
}
