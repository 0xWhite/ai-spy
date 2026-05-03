import {
  buildInitialRoomState,
  closeVotingPhase,
  eliminateSeat,
  enterTieBreakFromVotes,
  startGame,
  startNextDiscussion,
} from "@/lib/game/engine";
import { AI_WIN_ALIVE_SEAT_COUNT } from "@/lib/game/config";

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
    const now = 1_700_000_000_000;
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

    const nextRoom = closeVotingPhase(room, now);

    expect(nextRoom.phase).toBe("tiebreak_discussion");
    expect(nextRoom.tieSeatIds).toEqual(["seat-3", "seat-4"]);
    expect(nextRoom.phaseEndsAt).toBe(now + 60_000);
  });

  it("builds a tie-break discussion state with the configured timer", () => {
    const now = 1_700_000_000_000;
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    const nextRoom = enterTieBreakFromVotes(room, ["seat-4", "seat-2"], now);

    expect(nextRoom.phase).toBe("tiebreak_discussion");
    expect(nextRoom.tieSeatIds).toEqual(["seat-2", "seat-4"]);
    expect(nextRoom.phaseEndsAt).toBe(now + 60_000);
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

  it("ends the game with an AI winner at the MVP alive-seat threshold", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
      totalSeats: AI_WIN_ALIVE_SEAT_COUNT + 1,
    });

    const nextRoom = eliminateSeat(room, "seat-4");

    expect(nextRoom.phase).toBe("finished");
    expect(nextRoom.result?.winner).toBe("ai");
  });

  it("ignores invalid vote targets when closing voting", () => {
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "voting" as const,
      votes: {
        "seat-1": "not-a-seat",
        "seat-2": "seat-3",
        "seat-3": "seat-3",
      },
    };

    const nextRoom = closeVotingPhase(room, 1_700_000_000_000);

    expect(nextRoom.phase).toBe("eliminated_reveal");
    expect(nextRoom.eliminatedSeatIds).toEqual(["seat-3"]);
  });

  it("does not corrupt state when asked to eliminate an unknown seat", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
    });

    const nextRoom = eliminateSeat(room, "seat-999");

    expect(nextRoom).toEqual(room);
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
