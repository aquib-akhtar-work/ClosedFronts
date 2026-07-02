import { Execution, Game, Unit, UnitType } from "../game/Game";
import { PseudoRandom } from "../PseudoRandom";
import { TradeShipExecution } from "./TradeShipExecution";
import { TrainStationExecution } from "./TrainStationExecution";

/**
 * A Seaside Town is a coastal structure that combines a Port (spawns trade
 * ships) with a half-strength City (contributes to max population — handled in
 * `DefaultConfig.maxPopulation`). It is train-station-capable when a Factory is
 * nearby, just like a Port.
 *
 * In v0.32.6 the structure unit is built by `ConstructionExecution`, which
 * then constructs this execution with the already-built town `Unit`. Trade
 * destinations include both Ports and other Seaside Towns.
 */
export class SeasideTownExecution implements Execution {
  private active = true;
  private mg: Game;
  private town: Unit;
  private random: PseudoRandom;
  private checkOffset: number;
  private tradeShipSpawnRejections = 0;

  constructor(town: Unit) {
    this.town = town;
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(mg.ticks());
    this.checkOffset = mg.ticks() % 10;
  }

  tick(ticks: number): void {
    if (this.mg === null || this.random === null || this.checkOffset === null) {
      throw new Error("Not initialized");
    }

    if (!this.town.isActive()) {
      this.active = false;
      return;
    }

    if (this.town.isUnderConstruction()) {
      return;
    }

    if (!this.town.hasTrainStation()) {
      this.createStation();
    }

    // Only check every 10 ticks for performance.
    if ((this.mg.ticks() + this.checkOffset) % 10 !== 0) {
      return;
    }

    if (!this.shouldSpawnTradeShip()) {
      return;
    }

    const ports = this.tradingPorts();

    if (ports.length === 0) {
      return;
    }

    const port = this.random.randElement(ports);
    this.mg.addExecution(
      new TradeShipExecution(this.town.owner(), this.town, port),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  shouldSpawnTradeShip(): boolean {
    const numTradeShips = this.mg.unitCount(UnitType.TradeShip);
    const spawnRate = this.mg
      .config()
      .tradeShipSpawnRate(this.tradeShipSpawnRejections, numTradeShips);
    for (let i = 0; i < this.town!.level(); i++) {
      if (this.random.chance(spawnRate)) {
        this.tradeShipSpawnRejections = 0;
        return true;
      }
      this.tradeShipSpawnRejections++;
    }
    return false;
  }

  createStation(): void {
    const nearbyFactory = this.mg.hasUnitNearby(
      this.town.tile()!,
      this.mg.config().trainStationMaxRange(),
      UnitType.Factory,
    );
    if (nearbyFactory) {
      this.mg.addExecution(new TrainStationExecution(this.town));
    }
  }

  // Trade destinations: tradeable players' Ports AND Seaside Towns reachable
  // over water from this town. Mirrors `PortExecution.tradingPorts`, but the
  // candidate set includes Seaside Towns so they trade with each other.
  tradingPorts(): Unit[] {
    const sourceComponents = new Set<number>();
    for (const neighbor of this.mg.neighbors(this.town!.tile())) {
      if (!this.mg.isWater(neighbor)) continue;
      const comp = this.mg.getWaterComponent(neighbor);
      if (comp !== null) sourceComponents.add(comp);
    }
    const ports = this.mg
      .players()
      .filter((p) => p !== this.town!.owner() && p.canTrade(this.town!.owner()))
      .flatMap((p) => [
        ...p.units(UnitType.Port),
        ...p.units(UnitType.SeasideTown),
      ])
      .filter((p) => {
        for (const comp of sourceComponents) {
          if (this.mg.hasWaterComponent(p.tile(), comp)) return true;
        }
        return false;
      })
      .sort((p1, p2) => {
        return (
          this.mg.manhattanDist(this.town!.tile(), p1.tile()) -
          this.mg.manhattanDist(this.town!.tile(), p2.tile())
        );
      });

    const weightedPorts: Unit[] = [];

    for (const [i, otherPort] of ports.entries()) {
      const expanded = new Array(otherPort.level()).fill(otherPort);
      weightedPorts.push(...expanded);
      const tooClose =
        this.mg.manhattanDist(this.town!.tile(), otherPort.tile()) <
        this.mg.config().tradeShipShortRangeDebuff();
      const closeBonus =
        i < this.mg.config().proximityBonusPortsNb(ports.length);
      if (!tooClose && closeBonus) {
        weightedPorts.push(...expanded);
      }
      if (!tooClose && this.town!.owner().isFriendly(otherPort.owner())) {
        weightedPorts.push(...expanded);
      }
    }
    return weightedPorts;
  }
}
