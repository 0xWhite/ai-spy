const ROOM_SEAT_COOKIE_PREFIX = "room-";
const ROOM_SEAT_COOKIE_SUFFIX = "-seat";

type CookieReader = {
  get(name: string): { value: string } | undefined;
};

type CookieWriter = {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none" | boolean;
      secure?: boolean;
      path?: string;
    },
  ): void;
};

export function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase();
}

export function getRoomSeatCookieName(code: string) {
  return `${ROOM_SEAT_COOKIE_PREFIX}${normalizeRoomCode(code)}${ROOM_SEAT_COOKIE_SUFFIX}`;
}

export function getBoundSeatIdFromCookies(
  cookieStore: CookieReader,
  code: string,
) {
  return cookieStore.get(getRoomSeatCookieName(code))?.value ?? null;
}

export function bindSeatCookie(
  cookieStore: CookieWriter,
  code: string,
  seatId: string,
) {
  cookieStore.set(getRoomSeatCookieName(code), seatId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
