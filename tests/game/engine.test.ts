import {
  buildInitialRoomState,
  closeVotingPhase,
  eliminateSeat,
  enterTieBreakFromVotes,
  startGame,
  startNextDiscussion,
} from "@/lib/game/engine";

describe("game engine", () => {
  it("builds the initial room state with default seats and host connection", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    expect(room.phase).toBe("lobby");
    expect(room.seats).toHaveLength(7);
    expect(room.seats[0]).toMatchObject({
      id: "seat-1",
      role: "ai",
      color: "red",
      connected: false,
      isHost: false,
      status: "alive",
    });
    expect(room.seats[1]).toMatchObject({
      id: "seat-2",
      role: "human",
      color: "blue",
      connected: true,
      isHost: true,
      status: "alive",
    });
  });

  it("enters tie-break discussion with sorted tieSeatIds for a top-vote tie", () => {
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "voting" as const,
      votes: {
        "seat-1": "seat-4",
        "seat-2": "seat-3",
        "seat-3": "seat-4",
        "seat-4": "seat-3",
      },
    };

    const nextRoom = closeVotingPhase(room);

    expect(nextRoom.phase).toBe("tiebreak_discussion");
    expect(nextRoom.tieSeatIds).toEqual(["seat-3", "seat-4"]);
  });

  it("builds a tie-break discussion state from tied vote targets", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    const nextRoom = enterTieBreakFromVotes(room, ["seat-4", "seat-2"]);

    expect(nextRoom.phase).toBe("tiebreak_discussion");
    expect(nextRoom.tieSeatIds).toEqual(["seat-2", "seat-4"]);
  });

  it("eliminating the last AI ends the game with a human winner", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    const nextRoom = eliminateSeat(room, "seat-1");

    expect(nextRoom.phase).toBe("finished");
    expect(nextRoom.result?.winner).toBe("human");
    expect(nextRoom.seats.find((seat) => seat.id === "seat-1")?.status).toBe(
      "spectator",
    );
    expect(nextRoom.eliminatedSeatIds).toEqual(["seat-1"]);
  });

  it("starting round one discussion sets a 5-minute timer", () => {
    const now = 1_700_000_000_000;
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    const nextRoom = startGame(room, now);

    expect(nextRoom.phase).toBe("discussion");
    expect(nextRoom.round).toBe(1);
    expect(nextRoom.phaseEndsAt).toBe(now + 300_000);
    expect(nextRoom.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "第 1 轮讨论开始",
    });
  });

  it("starts the next discussion round with the standard timer and clears ties", () => {
    const now = 1_700_000_000_000;
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        now - 500_000,
      ),
      tieSeatIds: ["seat-3", "seat-4"],
    };

    const nextRoom = startNextDiscussion(room, now);

    expect(nextRoom.phase).toBe("discussion");
    expect(nextRoom.round).toBe(2);
    expect(nextRoom.tieSeatIds).toEqual([]);
    expect(nextRoom.phaseEndsAt).toBe(now + 180_000);
  });
});
