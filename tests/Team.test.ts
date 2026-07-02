import path from "path";
import {
  Cell,
  ColoredTeams,
  Duos,
  Game,
  GameMode,
  Nation,
  PlayerInfo,
  PlayerType,
} from "../src/core/game/Game";
import { assignTeamsLobbyPreview } from "../src/core/game/TeamAssignment";
import { playerInfo, setup } from "./util/Setup";

let game: Game;

describe("Teams", () => {
  test("bots are on the same team, but can attack each other", async () => {
    game = await setup("plains", { gameMode: GameMode.Team, playerTeams: 2 });

    const bot1 = game.addPlayer(playerInfo("bot1", PlayerType.Bot));
    const bot2 = game.addPlayer(playerInfo("bot2", PlayerType.Bot));

    // Both bots should be on the same team
    expect(bot1.team()).toBe(ColoredTeams.Bot);
    expect(bot2.team()).toBe(ColoredTeams.Bot);

    // But they should be allowed to attack each other.
    expect(bot1.isOnSameTeam(bot2)).toBe(false);
  });

  test("humans spawn on different teams", async () => {
    game = await setup(
      "plains",
      {
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [
        playerInfo("human1", PlayerType.Human),
        playerInfo("human2", PlayerType.Human),
      ],
    );
    expect(game.player("human1").isOnSameTeam(game.player("human2"))).toBe(
      false,
    );
  });

  test("host can pin two humans to the same team", async () => {
    const humanA = new PlayerInfo(
      "humanA",
      PlayerType.Human,
      "client-A",
      "client-A",
    );
    const humanB = new PlayerInfo(
      "humanB",
      PlayerType.Human,
      "client-B",
      "client-B",
    );
    game = await setup(
      "plains",
      {
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [humanA, humanB],
      path.join(__dirname, "util"),
      undefined,
      undefined,
      new Map([
        ["client-A", ColoredTeams.Red],
        ["client-B", ColoredTeams.Red],
      ]),
    );
    expect(game.player("client-A").team()).toBe(ColoredTeams.Red);
    expect(game.player("client-B").team()).toBe(ColoredTeams.Red);
    expect(game.player("client-A").isOnSameTeam(game.player("client-B"))).toBe(
      true,
    );
  });

  test("host pick overrides clan tag", async () => {
    const humanA = new PlayerInfo(
      "[AA]Alice",
      PlayerType.Human,
      "client-A",
      "client-A",
    );
    const humanB = new PlayerInfo(
      "[AA]Bob",
      PlayerType.Human,
      "client-B",
      "client-B",
    );
    game = await setup(
      "plains",
      {
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [humanA, humanB],
      path.join(__dirname, "util"),
      undefined,
      undefined,
      new Map([
        ["client-A", ColoredTeams.Red],
        ["client-B", ColoredTeams.Blue],
      ]),
    );
    // Host-pinned teams win, even though both share the [AA] clan tag.
    expect(game.player("client-A").team()).toBe(ColoredTeams.Red);
    expect(game.player("client-B").team()).toBe(ColoredTeams.Blue);
    expect(game.player("client-A").isOnSameTeam(game.player("client-B"))).toBe(
      false,
    );
  });

  test("unpinned humans still balance", async () => {
    const humanA = new PlayerInfo(
      "humanA",
      PlayerType.Human,
      "client-A",
      "client-A",
    );
    const humanB = new PlayerInfo(
      "humanB",
      PlayerType.Human,
      "client-B",
      "client-B",
    );
    const humanC = new PlayerInfo(
      "humanC",
      PlayerType.Human,
      "client-C",
      "client-C",
    );
    // No host pins. Three humans across two teams should split 2/1
    // (existing round-robin behavior).
    game = await setup(
      "plains",
      {
        gameMode: GameMode.Team,
        playerTeams: 2,
      },
      [humanA, humanB, humanC],
      path.join(__dirname, "util"),
      undefined,
      undefined,
      new Map(),
    );
    const teams = new Set([
      game.player("client-A").team(),
      game.player("client-B").team(),
      game.player("client-C").team(),
    ]);
    expect(teams.size).toBe(2);
  });

  test("host pins survive Duos math that expands past 7 teams", async () => {
    // Regression: when Duos math produces > 7 teams, the team list used to
    // be [Team 1, Team 2, ...] with no colored names, so a host's "Red"
    // pin was silently dropped and the humans ended up on different
    // numbered teams. Now the first 7 slots stay as the named colors.
    const humanA = new PlayerInfo(
      "humanA",
      PlayerType.Human,
      "client-A",
      "client-A",
    );
    const humanB = new PlayerInfo(
      "humanB",
      PlayerType.Human,
      "client-B",
      "client-B",
    );
    const nations: Nation[] = [];
    for (let i = 0; i < 24; i++) {
      nations.push(
        new Nation(
          new Cell(i, 0),
          new PlayerInfo(`nation${i}`, PlayerType.Nation, null, `nation-${i}`),
        ),
      );
    }
    // 2 humans + 24 nations = 26 players, Duos => ceil(26/2) = 13 teams.
    // The first 7 must remain the named colors so the host's pins resolve.
    game = await setup(
      "plains",
      {
        gameMode: GameMode.Team,
        playerTeams: Duos,
      },
      [humanA, humanB],
      path.join(__dirname, "util"),
      undefined,
      undefined,
      new Map([
        ["client-A", ColoredTeams.Red],
        ["client-B", ColoredTeams.Red],
      ]),
      nations,
    );
    // 13 player teams + the bot team = 14 entries.
    expect(game.teams().length).toBe(14);
    // The first 7 player teams are the named colors.
    expect(game.teams().slice(1, 8)).toEqual([
      ColoredTeams.Red,
      ColoredTeams.Blue,
      ColoredTeams.Yellow,
      ColoredTeams.Green,
      ColoredTeams.Purple,
      ColoredTeams.Orange,
      ColoredTeams.Teal,
    ]);
    // The host's pins to Red must be honored — both humans on Red, not on
    // some Team N slot.
    expect(game.player("client-A").team()).toBe(ColoredTeams.Red);
    expect(game.player("client-B").team()).toBe(ColoredTeams.Red);
    expect(game.player("client-A").isOnSameTeam(game.player("client-B"))).toBe(
      true,
    );
  });

  test("lobby preview honors host pins", () => {
    // The host lobby preview must reflect the host's per-client team picks so
    // the host sees the assignment the real game will produce, not an
    // auto-balanced guess. Two humans pinned to Red must both preview on Red.
    const humanA = new PlayerInfo(
      "humanA",
      PlayerType.Human,
      "client-A",
      "client-A",
    );
    const humanB = new PlayerInfo(
      "humanB",
      PlayerType.Human,
      "client-B",
      "client-B",
    );
    const teams = [ColoredTeams.Red, ColoredTeams.Blue];
    const pins = new Map([
      ["client-A", ColoredTeams.Red as string],
      ["client-B", ColoredTeams.Red as string],
    ]);
    const result = assignTeamsLobbyPreview([humanA, humanB], teams, 0, pins);
    expect(result.get(humanA)).toBe(ColoredTeams.Red);
    expect(result.get(humanB)).toBe(ColoredTeams.Red);
  });
});
