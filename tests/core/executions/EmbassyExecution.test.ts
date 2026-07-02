import { SpawnExecution } from "../../../src/core/execution/SpawnExecution";
import {
  Game,
  Player,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "../../../src/core/game/Game";
import { setup } from "../../util/Setup";

const gameID = "game_id";

let game: Game;
let builder: Player;
let host: Player;
let hostTile: ReturnType<Game["ref"]>;

describe("Embassy", () => {
  beforeEach(async () => {
    game = await setup("big_plains", {
      infiniteGold: true,
      instantBuild: true,
    });
    const builderInfo = new PlayerInfo(
      "builder",
      PlayerType.Human,
      null,
      "builder",
    );
    const hostInfo = new PlayerInfo("host", PlayerType.Human, null, "host");
    game.addPlayer(builderInfo);
    game.addPlayer(hostInfo);
    // Spawn the builder far from the host so combat never reaches the host's
    // core territory (and the embassy placed there stays put) during the test.
    game.addExecution(
      new SpawnExecution(gameID, builderInfo, game.ref(190, 1)),
    );
    game.addExecution(new SpawnExecution(gameID, hostInfo, game.ref(1, 1)));
    // setup() auto-ends the spawn phase, so drive the SpawnExecutions through
    // explicit ticks (they still run outside spawn phase). Two ticks: init,
    // then spawn.
    game.executeNextTick();
    game.executeNextTick();
    builder = game.player("builder");
    host = game.player("host");
    // SpawnExecution may relocate the spawn to a nearby valid tile, so use a
    // tile the host actually owns rather than the requested coordinate.
    const owned = Array.from(host.tiles());
    expect(owned.length).toBeGreaterThan(0);
    hostTile = owned[0];
    expect(game.owner(hostTile)).toBe(host);
  });

  test("hasEmbassyIn reflects an embassy built on foreign territory", () => {
    builder.buildUnit(UnitType.Embassy, hostTile, {});
    expect(builder.hasEmbassyIn(host)).toBe(true);
    // The host has not built an embassy back in the builder's land.
    expect(host.hasEmbassyIn(builder)).toBe(false);
  });

  test("a builder may place only one embassy per foreign nation", () => {
    // One embassy per host territory: after the builder places an embassy in
    // the host's land, canBuild must reject a second embassy anywhere in that
    // same nation's territory (the player upgrades the existing one instead).
    const first = builder.buildUnit(UnitType.Embassy, hostTile, {});
    expect(first).toBeDefined();
    expect(builder.hasEmbassyIn(host)).toBe(true);
    // A second embassy in the host's territory must be refused.
    expect(builder.canBuild(UnitType.Embassy, hostTile)).toBeFalsy();
  });
});
