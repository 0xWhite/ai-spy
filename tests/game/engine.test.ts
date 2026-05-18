import { describe, expect, it } from "vitest";
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
      number: 1,
      color: "red",
      connected: false,
      isHost: false,
      status: "alive",
    });
    expect(room.seats[1]).toMatchObject({
      id: "seat-2",
      role: "human",
      number: 2,
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

  it("rejects voting twice in the same voting phase", () => {
    const room = {
      ...startGame(
        buildInitialRoomState({
          hostSeatId: "seat-2",
        }),
        1_700_000_000_000,
      ),
      phase: "voting" as const,
      votes: {
        "seat-2": "seat-3",
      },
    };

    expect(() =>
      castVote(room, {
        voterSeatId: "seat-2",
        targetSeatId: "seat-4",
      }),
    ).toThrow("SEAT_ALREADY_VOTED");
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
      expect(nextRoom.phaseEndsAt).toBe(1_700_000_003_000);
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
    expect(nextRoom.phaseEndsAt).toBe(now + 3_000);
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

  it("scales the AI win threshold down for smaller local test games", () => {
    const room = startGame(
      {
        ...buildInitialRoomState({
          hostSeatId: "seat-1",
          totalSeats: 7,
          aiCount: 1,
        }),
        seats: buildInitialRoomState({
          hostSeatId: "seat-1",
          totalSeats: 7,
          aiCount: 1,
        }).seats.map((seat) => {
          if (seat.id === "seat-1") {
            return {
              ...seat,
              role: "human" as const,
              connected: true,
            };
          }

          if (seat.id === "seat-2") {
            return {
              ...seat,
              role: "ai" as const,
              connected: true,
            };
          }

          if (seat.id === "seat-3") {
            return {
              ...seat,
              role: "human" as const,
              connected: true,
            };
          }

          return seat;
        }),
      },
      1_700_000_000_000,
      () => 0,
    );

    expect(room.seats).toHaveLength(3);

    const nextRoom = eliminateSeat(room, room.seats.find((seat) => seat.role === "human" && seat.id !== "seat-1")!.id);

    expect(nextRoom.phase).toBe("finished");
    expect(nextRoom.result?.winner).toBe("ai");
  });

  it("advances eliminated reveal into the next discussion after the reveal timer", () => {
    const now = 1_700_000_000_000;
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "voting" as const,
      votes: {
        "seat-1": "seat-3",
        "seat-2": "seat-3",
        "seat-3": "seat-4",
      },
    };

    const eliminatedRoom = advancePhaseFromTimeout(room, now);
    const nextRound = advancePhaseFromTimeout(
      {
        ...eliminatedRoom,
        phase: "eliminated_reveal" as const,
      },
      now + 3_000,
    );

    expect(eliminatedRoom.phase).toBe("eliminated_reveal");
    expect(eliminatedRoom.phaseEndsAt).toBe(now + 3_000);
    expect(nextRound.phase).toBe("discussion");
    expect(nextRound.round).toBe(1);
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

  it("appends a vote result system message before eliminating the top-voted seat", () => {
    const now = 1_700_000_000_000;
    const room = {
      ...buildInitialRoomState({
        hostSeatId: "seat-2",
      }),
      phase: "voting" as const,
      votes: {
        "seat-1": "seat-4",
        "seat-2": "seat-4",
        "seat-3": "seat-1",
        "seat-4": "seat-4",
        "seat-5": "seat-1",
      },
    };

    const nextRoom = closeVotingPhase(room, now);

    expect(nextRoom.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "投票结果：4号 3票，1号 2票。4号出局。",
      createdAt: now,
    });
  });

  it("appends a vote result system message before entering a tiebreak", () => {
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

    expect(nextRoom.messages.at(-1)).toMatchObject({
      kind: "system",
      text: "投票结果：3号 2票，4号 2票。进入平票加赛。",
      createdAt: now,
    });
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

  it("starts the game with connected humans plus AI only, and assigns randomized colors and numbers", () => {
    const now = 1_700_000_000_000;
    const room = buildInitialRoomState({
      hostSeatId: "seat-1",
      totalSeats: 7,
      aiCount: 2,
    });

    room.seats = room.seats.map((seat) => {
      if (seat.id === "seat-1") {
        return {
          ...seat,
          role: "human" as const,
        };
      }

      if (seat.id === "seat-3") {
        return {
          ...seat,
          role: "ai" as const,
        };
      }

      if (seat.id === "seat-4") {
        return {
          ...seat,
          connected: true,
        };
      }

      return seat;
    });

    const nextRoom = startGame(room, now, () => 0);

    expect(nextRoom.seats).toHaveLength(4);
    expect(nextRoom.seats.map((seat) => seat.id).sort()).toEqual([
      "seat-1",
      "seat-2",
      "seat-3",
      "seat-4",
    ]);
    expect(nextRoom.seats.filter((seat) => seat.role === "human")).toHaveLength(2);
    expect(nextRoom.seats.filter((seat) => seat.role === "ai")).toHaveLength(2);
    expect(nextRoom.seats.every((seat) => seat.connected)).toBe(true);
    expect(nextRoom.seats.map((seat) => seat.number).sort((left, right) => left - right)).toEqual([
      1,
      2,
      3,
      4,
    ]);
    expect(new Set(nextRoom.seats.map((seat) => seat.color)).size).toBe(4);
  });

  it("shuffles active participant order before assigning visible seats", () => {
    const now = 1_700_000_000_000;
    const room = buildInitialRoomState({
      hostSeatId: "seat-1",
      totalSeats: 7,
      aiCount: 1,
    });

    room.seats = room.seats.map((seat) => {
      if (seat.id === "seat-1") {
        return {
          ...seat,
          role: "human" as const,
          connected: true,
        };
      }

      if (seat.id === "seat-2") {
        return {
          ...seat,
          role: "ai" as const,
        };
      }

      if (seat.id === "seat-4") {
        return {
          ...seat,
          connected: true,
        };
      }

      return seat;
    });

    const nextRoom = startGame(room, now, () => 0);

    expect(nextRoom.seats.map((seat) => seat.id)).toEqual([
      "seat-4",
      "seat-2",
      "seat-1",
    ]);
    expect(nextRoom.seats.map((seat) => seat.number).sort((left, right) => left - right)).toEqual([
      1,
      2,
      3,
    ]);
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
