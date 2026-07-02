import { Execution, Game, Unit } from "../game/Game";

/**
 * An Embassy is built on a foreign, tradeable player's territory. It pays
 * passive gold to its owner (the builder) on a fixed interval, and grants the
 * host nation a +100% trade bonus on ships/trains between them (applied in
 * `TradeShipExecution` and `TrainStation` stop handlers via `hasEmbassyIn`).
 *
 * In v0.32.6 the structure unit is built by `ConstructionExecution`, which
 * then constructs this execution with the already-built embassy `Unit`. The
 * embassy must be `territoryBound: false` with instant (zero-duration)
 * construction so the host nation cannot steal it during the construction
 * phase — see the foreign-territory-buildings memory note.
 */
export class EmbassyExecution implements Execution {
  private mg: Game;
  private active: boolean = true;
  private checkOffset: number = 0;

  constructor(private embassy: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.checkOffset = ticks % mg.config().embassyGoldInterval();
  }

  tick(ticks: number): void {
    if (!this.embassy.isActive()) {
      this.active = false;
      return;
    }

    const interval = this.mg.config().embassyGoldInterval();
    // Only pay out once per interval (offset-staggered across embassies).
    if ((this.mg.ticks() + this.checkOffset) % interval !== 0) {
      return;
    }

    const gold = this.mg.config().embassyPassiveGold(this.embassy.level());
    this.embassy.owner().addGold(gold, this.embassy.tile());
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }
}
