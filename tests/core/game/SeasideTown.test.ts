import { PortExecution } from "../../../src/core/execution/PortExecution";
import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  Unit,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

const gameID = "game_id";

function spawnTwoPlayers(
  game: Game,
  aTile: ReturnType<Game["ref"]>,
  bTile: ReturnType<Game["ref"]>,
): { a: Player; b: Player } {
  const aInfo = new PlayerInfo("playerA", PlayerType.Human, null, "playerA");
  const bInfo = new PlayerInfo("playerB", PlayerType.Human, null, "playerB");
  game.addPlayer(aInfo);
  game.addPlayer(bInfo);
  game.addExecution(new SpawnExecution(gameID, aInfo, aTile));
  game.addExecution(new SpawnExecution(gameID, bInfo, bTile));
  // setup() auto-ends the spawn phase; drive the SpawnExecutions through
  // explicit ticks (init, then spawn).
  game.executeNextTick();
  game.executeNextTick();
  return { a: game.player("playerA"), b: game.player("playerB") };
}

/** Find a shore tile owned by `player` that borders water component `comp`. */
function findShoreTileOnWater(
  game: Game,
  player: Player,
  comp: number | null,
): ReturnType<Game["ref"]> | null {
  for (const t of player.tiles()) {
    if (!game.isShore(t)) continue;
    for (const n of game.neighbors(t)) {
      if (!game.isWater(n)) continue;
      const c = game.getWaterComponent(n);
      if (c !== null && (comp === null || c === comp)) return t;
    }
  }
  return null;
}

describe("SeasideTown (stats and population)", () => {
  let game: Game;
  let playerA: Player;

  beforeEach(async () => {
    game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });
    const { a } = spawnTwoPlayers(game, game.ref(50, 50), game.ref(150, 150));
    playerA = a;
  });

  test("raises max troops by 50% of a city per level", () => {
    const before = game.config().maxTroops(playerA);
    const tile = Array.from(playerA.tiles())[0];
    playerA.buildUnit(UnitType.SeasideTown, tile, {});
    const after = game.config().maxTroops(playerA);
    // A freshly built town is level 1, contributing
    //   1 * seasideTownPopulationFactor() * cityTroopIncrease().
    const expected =
      1 *
      game.config().seasideTownPopulationFactor() *
      game.config().cityTroopIncrease();
    expect(after - before).toBeCloseTo(expected, 0);
  });

  test("counts toward tradePortCount", () => {
    expect(playerA.tradePortCount()).toBe(0);
    const tile = Array.from(playerA.tiles())[0];
    playerA.buildUnit(UnitType.SeasideTown, tile, {});
    expect(playerA.tradePortCount()).toBe(1);
  });
});

describe("SeasideTown (trade integration)", () => {
  let game: Game;
  let playerA: Player;
  let playerB: Player;

  beforeEach(async () => {
    game = await setup("ocean_and_land", {
      infiniteGold: true,
      instantBuild: true,
    });
    const { a, b } = spawnTwoPlayers(game, game.ref(7, 3), game.ref(14, 8));
    playerA = a;
    playerB = b;
  });

  test("is a valid trade destination in PortExecution.tradingPorts", () => {
    // Find the shared water body off player A's coast.
    const aShore = findShoreTileOnWater(game, playerA, null);
    expect(aShore).not.toBeNull();
    let comp: number | null = null;
    for (const n of game.neighbors(aShore!)) {
      if (game.isWater(n)) {
        comp = game.getWaterComponent(n);
        if (comp !== null) break;
      }
    }
    expect(comp).not.toBeNull();

    const portA = playerA.buildUnit(UnitType.Port, aShore!, {});
    const bShore = findShoreTileOnWater(game, playerB, comp);
    expect(bShore).not.toBeNull();
    const townB: Unit = playerB.buildUnit(UnitType.SeasideTown, bShore!, {});

    const exec = new PortExecution(portA);
    exec.init(game, 0);
    const ports = exec.tradingPorts();
    expect(ports).toContain(townB);
  });
});
