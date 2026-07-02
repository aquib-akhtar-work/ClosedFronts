import { beforeEach, describe, expect, it, vi } from "vitest";

// Pass-through the start-info parse so we can inspect the exact object the
// server builds before it ships to clients.
vi.mock("../../src/core/Schemas", async () => {
  const actual = (await vi.importActual("../../src/core/Schemas")) as any;
  return {
    ...actual,
    GameStartInfoSchema: {
      safeParse: (data: any) => ({ success: true, data }),
    },
    ServerPrestartMessageSchema: {
      safeParse: (data: any) => ({ success: true, data }),
    },
  };
});

import { GameMode, GameType } from "../../src/core/game/Game";
import { ClientMessageSchema } from "../../src/core/Schemas";
import { Client } from "../../src/server/Client";
import { GameServer } from "../../src/server/GameServer";

function makeMockWs() {
  return {
    on: () => {},
    removeAllListeners: () => {},
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  };
}

function makeClient(
  clientID: string,
  persistentID: string,
  username: string,
): Client {
  return new Client(
    clientID,
    persistentID,
    null,
    null,
    undefined,
    "127.0.0.1",
    username,
    null,
    makeMockWs() as any,
    undefined,
    undefined,
    [],
  );
}

function makeGame() {
  const logger: any = {
    child: vi.fn().mockReturnThis(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const game = new GameServer(
    "g1",
    logger,
    Date.now(),
    {
      gameType: GameType.Private,
      gameMode: GameMode.Team,
      playerTeams: 2,
      gameMap: "Asia",
      gameMapSize: 100,
    } as any,
    "host-pid",
  );
  [
    makeClient("host", "host-pid", "Host"),
    makeClient("guest", "guest-pid", "Guest"),
  ].forEach((c) => game.joinClient(c));
  return game;
}

describe("GameServer team-pin wire", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("host pins both players to Red -> both reach gameStartInfo as Red", () => {
    const game = makeGame();
    game.updateGameConfig({
      gameMode: GameMode.Team,
      playerTeams: 2,
      clientTeams: { host: "Red", guest: "Red" },
    });

    game.prestart();
    game.start();

    const startInfo = (game as any).gameStartInfo;
    expect(startInfo).toBeDefined();
    const byId = (id: string) =>
      startInfo.players.find((p: any) => p.clientID === id);
    expect(byId("host").team).toBe("Red");
    expect(byId("guest").team).toBe("Red");
  });

  it("host pins only the guest -> host unpinned, guest Red", () => {
    const game = makeGame();
    game.updateGameConfig({
      gameMode: GameMode.Team,
      playerTeams: 2,
      clientTeams: { guest: "Red" },
    });

    game.prestart();
    game.start();

    const startInfo = (game as any).gameStartInfo;
    const byId = (id: string) =>
      startInfo.players.find((p: any) => p.clientID === id);
    expect(byId("guest").team).toBe("Red");
    // Host was left on "Auto" -> no team field on the wire.
    expect(byId("host").team).toBeUndefined();
  });

  it("update_game_config intent over the wire preserves clientTeams", () => {
    // Replicates the real client path: a websocket {type:"intent"} message
    // is parsed by ClientMessageSchema (Zod strips unknown keys), then
    // handleIntent routes it to updateGameConfig. Verifies clientTeams
    // survives Zod parsing and reaches the server's pin map.
    const game = makeGame();
    const msg = {
      type: "intent",
      intent: {
        type: "update_game_config",
        config: {
          gameMode: GameMode.Team,
          playerTeams: 2,
          clientTeams: { host: "Red", guest: "Red" },
        },
      },
    };
    const parsed = ClientMessageSchema.safeParse(msg);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const outcome = game.handleIntent(parsed.data.intent, {
      clientID: "host",
      isLobbyCreator: true,
      isAdmin: false,
      isAdminBot: false,
    });
    expect(outcome.status).toBe(200);

    // Both pins must be stored server-side.
    const pins = (game as any).clientTeams as Map<string, string>;
    expect(pins.get("host")).toBe("Red");
    expect(pins.get("guest")).toBe("Red");

    game.prestart();
    game.start();
    const startInfo = (game as any).gameStartInfo;
    const byId = (id: string) =>
      startInfo.players.find((p: any) => p.clientID === id);
    expect(byId("host").team).toBe("Red");
    expect(byId("guest").team).toBe("Red");
  });

  it("host flips a default-FFA private game to Team with pins (the real flow)", () => {
    // GameManager.createGame defaults gameMode to FFA. The host's only chance
    // to set Team mode is the update_game_config intent. If that flip ever
    // fails to land on this.gameConfig.gameMode, GameImpl.addPlayers hits the
    // FFA bypass and silently drops every pin -> lobby shows same team (client
    // gameMode is Team) but the game splits them. This locks the flip.
    const logger: any = {
      child: vi.fn().mockReturnThis(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const game = new GameServer(
      "g1",
      logger,
      Date.now(),
      {
        gameType: GameType.Private,
        gameMode: GameMode.FFA, // the real default
        gameMap: "Asia",
        gameMapSize: 100,
      } as any,
      "host-pid",
    );
    [
      makeClient("host", "host-pid", "Host"),
      makeClient("guest", "guest-pid", "Guest"),
    ].forEach((c) => game.joinClient(c));

    const parsed = ClientMessageSchema.safeParse({
      type: "intent",
      intent: {
        type: "update_game_config",
        config: {
          gameMode: GameMode.Team,
          playerTeams: 2,
          clientTeams: { host: "Red", guest: "Red" },
        },
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(
      game.handleIntent(parsed.data.intent, {
        clientID: "host",
        isLobbyCreator: true,
        isAdmin: false,
        isAdminBot: false,
      }).status,
    ).toBe(200);

    // The flip must land on the server's config, not just the intent echo.
    expect(game.gameConfig.gameMode).toBe(GameMode.Team);

    game.prestart();
    game.start();
    const startInfo = (game as any).gameStartInfo;
    expect(startInfo.config.gameMode).toBe(GameMode.Team);
    const byId = (id: string) =>
      startInfo.players.find((p: any) => p.clientID === id);
    expect(byId("host").team).toBe("Red");
    expect(byId("guest").team).toBe("Red");
  });
});
