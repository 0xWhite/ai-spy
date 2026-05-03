import {
  advancePhaseFromTimeout,
  appendPlayerMessage,
  buildInitialRoomState,
  castVote,
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
    expect(room.config.endgameAliveSeatCount).toBe(3);
  });

  it("prevents spectators from sending messages", () => {
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        1_700_000_000_000,
      ),
      seats: buildInitialRoomState({
        hostSeatId: "seat-2",
      }).seats.map((seat) =>
        seat.id === "seat-3" ? { ...seat, status: "spectator" as const } : seat,
      ),
    };

    expect(() =>
      appendPlayerMessage(room, {
        seatId: "seat-3",
        text: "hello",
        now: 1_700_000_000_001,
      }),
    ).toThrow("SEAT_CANNOT_SPEAK");
  });

  it("appends a trimmed player message for an alive seat", () => {
    const room = startGame(
      buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      1_700_000_000_000,
    );

    const nextRoom = appendPlayerMessage(room, {
      seatId: "seat-2",
      text: "  大家好  ",
      now: 1_700_000_000_001,
    });

    expect(nextRoom.messages.at(-1)).toMatchObject({
      kind: "player",
      seatId: "seat-2",
      text: "大家好",
      createdAt: 1_700_000_000_001,
    });
  });

  it("rejects player messages outside discussion phases", () => {
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        1_700_000_000_000,
      ),
      phase: "voting" as const,
    };

    expect(() =>
      appendPlayerMessage(room, {
        seatId: "seat-2",
        text: "still talking",
        now: 1_700_000_000_001,
      }),
    ).toThrow("PHASE_DOES_NOT_ALLOW_MESSAGES");
  });

  it("rejects self-votes", () => {
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        1_700_000_000_000,
      ),
      phase: "voting" as const,
    };

    expect(() =>
      castVote(room, {
        voterSeatId: "seat-2",
        targetSeatId: "seat-2",
      }),
    ).toThrow("CANNOT_VOTE_SELF");
  });

  it("rejects invalid vote targets", () => {
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        1_700_000_000_000,
      ),
      phase: "tiebreak_voting" as const,
      tieSeatIds: ["seat-3", "seat-4"],
    };

    expect(() =>
      castVote(room, {
        voterSeatId: "seat-2",
        targetSeatId: "seat-5",
      }),
    ).toThrow("INVALID_VOTE_TARGET");
  });

  it("rejects votes outside voting phases", () => {
    const room = startGame(
      buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      1_700_000_000_000,
    );

    expect(() =>
      castVote(room, {
        voterSeatId: "seat-2",
        targetSeatId: "seat-3",
      }),
    ).toThrow("PHASE_DOES_NOT_ALLOW_VOTES");
  });

  it("advances discussion timeout into voting and appends a system message", () => {
    const now = 1_700_000_100_000;
    const room = startGame(
      buildInitialRoomState({
        hostSeatId: "seat-2",
        voteSeconds: 45,
      }),
      now - 10_000,
    );

    const nextRoom = advancePhaseFromTimeout(room, now);

    expect(nextRoom.phase).toBe("voting");
    expect(nextRoom.phaseEndsAt).toBe(now + 45_000);
    expect(nextRoom.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "讨论结束，进入投票阶段",
      createdAt: now,
    });
  });

  it.each([
    ["voting", "eliminated_reveal"],
    ["tiebreak_voting", "eliminated_reveal"],
  ] as const)(
    "resolves %s timeout through closeVotingPhase",
    (phase, expectedPhase) => {
      const room = {
        ...buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        phase,
        tieSeatIds: phase === "tiebreak_voting" ? ["seat-3", "seat-4"] : [],
        votes: {
          "seat-1": "seat-3",
          "seat-2": "seat-3",
          "seat-3": "seat-4",
        },
      };

      const nextRoom = advancePhaseFromTimeout(room, 1_700_000_000_000);

      expect(nextRoom.phase).toBe(expectedPhase);
      expect(nextRoom.eliminatedSeatIds).toEqual(["seat-3"]);
    },
  );

  it("resolves voting timeout with zero valid votes into a full tie-break discussion", () => {
    const now = 1_700_000_000_000;
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "voting" as const,
      phaseEndsAt: now,
      votes: {},
    };

    const nextRoom = advancePhaseFromTimeout(room, now);

    expect(nextRoom.phase).toBe("tiebreak_discussion");
    expect(nextRoom.tieSeatIds).toEqual([
      "seat-1",
      "seat-2",
      "seat-3",
      "seat-4",
      "seat-5",
      "seat-6",
      "seat-7",
    ]);
    expect(nextRoom.phaseEndsAt).toBe(now + 60_000);
  });

  it("resolves tiebreak voting timeout with zero valid votes by eliminating a deterministic tied seat", () => {
    const now = 1_700_000_000_000;
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "tiebreak_voting" as const,
      tieSeatIds: ["seat-4", "seat-3"],
      phaseEndsAt: now,
      votes: {},
    };

    const nextRoom = advancePhaseFromTimeout(room, now);

    expect(nextRoom.phase).toBe("eliminated_reveal");
    expect(nextRoom.eliminatedSeatIds).toEqual(["seat-3"]);
    expect(nextRoom.tieSeatIds).toEqual([]);
    expect(nextRoom.phaseEndsAt).toBeNull();
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

  it("ends the game with an AI winner at the config-backed alive-seat threshold", () => {
    const room = buildInitialRoomState({
      hostSeatId: "seat-2",
      totalSeats: 5,
      endgameAliveSeatCount: 4,
    });

    const nextRoom = eliminateSeat(room, "seat-5");

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
