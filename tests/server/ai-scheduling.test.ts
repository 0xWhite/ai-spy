import { describe, expect, it } from "vitest";
import { buildInitialRoomState, startGame } from "@/lib/game/engine";
import {
  calculateAiTurnDelayMs,
} from "@/lib/server/ai/scheduling";

function buildDiscussionRoom() {
  const initialRoom = buildInitialRoomState({
    hostSeatId: "seat-1",
  });

  return {
    code: "ABCDEF",
    ...startGame(
      {
        ...initialRoom,
        seats: initialRoom.seats.map((seat) => {
          if (seat.id === "seat-1") {
            return { ...seat, role: "human" as const };
          }

          if (seat.id === "seat-2") {
            return { ...seat, role: "ai" as const };
          }

          if (seat.id === "seat-3") {
            return { ...seat, connected: true };
          }

          return seat;
        }),
      },
      1_700_000_000_000,
      () => 0,
    ),
  };
}

describe("AI scheduling", () => {
  it("does not let AI speak immediately at phase start", () => {
    const room = buildDiscussionRoom();

    const delayMs = calculateAiTurnDelayMs(room, {
      source: "user",
      random: () => 0,
      now: 1_700_000_000_500,
    });

    expect(delayMs).toBeGreaterThanOrEqual(4_000);
  });

  it("waits a human-like amount of time before replying to a fresh human message", () => {
    const room = buildDiscussionRoom();
    room.messages.push({
      id: "player-1",
      kind: "player",
      seatId: "seat-1",
      text: "3号你刚才什么意思，具体说一下？",
      createdAt: 1_700_000_001_000,
    });

    const delayMs = calculateAiTurnDelayMs(room, {
      source: "user",
      random: () => 0,
      now: 1_700_000_001_100,
    });

    expect(delayMs).toBeGreaterThanOrEqual(2_500);
    expect(delayMs).toBeLessThanOrEqual(9_000);
  });

  it("keeps voting reactions shorter than discussion replies", () => {
    const room = {
      ...buildDiscussionRoom(),
      phase: "voting" as const,
      phaseEndsAt: 1_700_000_060_000,
    };

    const delayMs = calculateAiTurnDelayMs(room, {
      source: "user",
      random: () => 0,
      now: 1_700_000_010_000,
    });

    expect(delayMs).toBeGreaterThanOrEqual(1_200);
    expect(delayMs).toBeLessThan(4_000);
  });
});
