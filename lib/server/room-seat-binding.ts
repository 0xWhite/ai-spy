import type { RoomSnapshot } from "@/lib/server/room-store";
import { getBoundSeatIdFromCookies } from "@/lib/server/room-seat-cookie";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

export function getValidatedBoundSeatId(
  cookieStore: CookieReader,
  room: Pick<RoomSnapshot, "code" | "seats">,
) {
  const seatId = getBoundSeatIdFromCookies(cookieStore, room.code);
  if (!seatId) {
    return null;
  }

  return room.seats.some((seat) => seat.id === seatId && seat.role === "human")
    ? seatId
    : null;
}
