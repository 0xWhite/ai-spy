import type { RoomResult, RoomState, SeatState } from "@/lib/game/types";

export type RoomSnapshotPhase = "waiting" | "closed" | RoomState["phase"];

export interface RoomSnapshot extends Omit<RoomState, "phase"> {
  code: string;
  phase: RoomSnapshotPhase;
}

export type WaitingClientSeatState = Pick<
  SeatState,
  "id" | "status" | "connected" | "isHost"
>;
export type HiddenClientSeatState = Omit<SeatState, "role" | "isHost">;
export type RevealedClientSeatState = Omit<SeatState, "isHost">;
export type ClientSeatState =
  | WaitingClientSeatState
  | HiddenClientSeatState
  | RevealedClientSeatState;

export interface ClientRoomSnapshot extends Omit<RoomSnapshot, "seats" | "votes"> {
  seats: ClientSeatState[];
  selfVoteTargetId: string | null;
}

export interface RevealedClientRoomSnapshot extends ClientRoomSnapshot {
  phase: "finished";
  result: RoomResult;
  seats: RevealedClientSeatState[];
}

function cloneRoomSnapshot(room: RoomSnapshot) {
  return structuredClone(room);
}

function isHiddenVotePhase(phase: RoomSnapshotPhase) {
  return phase === "voting" || phase === "tiebreak_voting";
}

export function toClientRoomSnapshot(
  room: RoomSnapshot,
  viewerSeatId: string | null = null,
): ClientRoomSnapshot {
  const revealRoles = room.phase === "finished" && room.result !== null;
  const { votes, ...clientRoom } = cloneRoomSnapshot(room);
  void votes;
  const waitingSeats =
    room.phase === "waiting"
      ? room.seats.filter((seat) => seat.role === "human")
      : null;

  return {
    ...clientRoom,
    selfVoteTargetId:
      viewerSeatId && isHiddenVotePhase(room.phase)
        ? room.votes[viewerSeatId] ?? null
        : null,
    seats: (waitingSeats ?? room.seats).map((seat) => {
      if (waitingSeats) {
        return {
          id: seat.id,
          status: seat.status,
          connected: seat.connected,
          isHost: seat.isHost,
        };
      }

      if (revealRoles) {
        const { isHost, ...revealedSeat } = seat;
        void isHost;
        return revealedSeat;
      }

      const { isHost, role, ...hiddenSeat } = seat;
      void isHost;
      void role;
      return hiddenSeat;
    }),
  };
}

export function hasRevealedClientRoles(
  room: ClientRoomSnapshot,
): room is RevealedClientRoomSnapshot {
  return (
    room.phase === "finished" &&
    room.result !== null &&
    room.seats.every((seat) => "role" in seat)
  );
}
