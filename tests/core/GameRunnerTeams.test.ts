import path from "path";
import {
  ColoredTeams,
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
} from "../../src/core/game/Game";
import { createGameRunner } from "../../src/core/GameRunner";
import { GameConfig, GameStartInfo } from "../../src/core/Schemas";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

function baseConfig(gameMode: GameMode): GameConfig {
  return {
    gameMap: GameMapType.Asia,
    gameMapSize: GameMapSize.Normal,
    gameMode,
    gameType: GameType.Private,
    difficulty: Difficulty.Medium,
    nations: "default",
    donateGold: false,
    donateTroops: false,
    bots: 0,
    infiniteGold: false,
    infiniteTroops: false,
    instantBuild: false,
    randomSpawn: false,
    playerTeams: 2,
  };
}

describe("GameRunner host team pins (server wire)", () => {
  // Mirrors exactly what GameServer.start() emits: each active client becomes
  // a PlayerSchema with `team: this.clientTeams.get(c.clientID)`, and that
  // GameStartInfo feeds createGameRunner. This guards the full
  // gameStartInfo.players[].team -> hostTeams -> GameImpl -> assignTeams wire
  // that the unit-level Team.test.ts (which pins via setup() directly) does
  // not exercise.
  const mapLoader = new NodeGameMapLoader(
    path.join(PROJECT_ROOT, "resources", "maps"),
  );

  test("two players pinned to Red both land on Red", async () => {
    const gameStart: GameStartInfo = {
      gameID: "team-pin-game",
      lobbyCreatedAt: 0,
      config: baseConfig(GameMode.Team),
      players: [
        {
          clientID: "client-A",
          username: "humanA",
          clanTag: null,
          isLobbyCreator: true,
          team: ColoredTeams.Red,
        },
        {
          clientID: "client-B",
          username: "humanB",
          clanTag: null,
          team: ColoredTeams.Red,
        },
      ],
    };

    const runner = await createGameRunner(
      gameStart,
      "client-A",
      mapLoader,
      () => {},
    );
    const a = runner.game.playerByClientID("client-A");
    const b = runner.game.playerByClientID("client-B");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.team()).toBe(ColoredTeams.Red);
    expect(b!.team()).toBe(ColoredTeams.Red);
    expect(a!.isOnSameTeam(b!)).toBe(true);
  });

  test("only one player pinned -> the other auto-balances to the other team", async () => {
    // This is the "host pinned the guest but left themselves on Auto" case:
    // the unpinned host is balanced to the emptiest team, so they split.
    const gameStart: GameStartInfo = {
      gameID: "team-pin-one-game",
      lobbyCreatedAt: 0,
      config: baseConfig(GameMode.Team),
      players: [
        {
          clientID: "client-A",
          username: "humanA",
          clanTag: null,
          isLobbyCreator: true,
          // No team -> auto-balance.
        },
        {
          clientID: "client-B",
          username: "humanB",
          clanTag: null,
          team: ColoredTeams.Red,
        },
      ],
    };

    const runner = await createGameRunner(
      gameStart,
      "client-A",
      mapLoader,
      () => {},
    );
    const a = runner.game.playerByClientID("client-A");
    const b = runner.game.playerByClientID("client-B");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(b!.team()).toBe(ColoredTeams.Red);
    // A is unpinned -> balanced to the emptiest team (Blue, since Red has B).
    expect(a!.team()).toBe(ColoredTeams.Blue);
    expect(a!.isOnSameTeam(b!)).toBe(false);
  });
});
