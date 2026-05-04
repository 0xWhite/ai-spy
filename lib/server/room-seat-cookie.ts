import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ROOM_SEAT_COOKIE_PREFIX = "room-";
const ROOM_SEAT_COOKIE_SUFFIX = "-seat";
const ROOM_SEAT_COOKIE_VERSION = "v1";
// Room state already lives in-memory per process, so a process-local fallback
// secret matches the current single-process MVP assumptions.
const ROOM_SEAT_COOKIE_SECRET =
  process.env.ROOM_SEAT_COOKIE_SECRET?.trim() || randomBytes(32).toString("base64url");

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

function signRoomSeatCookie(code: string, seatId: string) {
  return createHmac("sha256", ROOM_SEAT_COOKIE_SECRET)
    .update(`${ROOM_SEAT_COOKIE_VERSION}:${normalizeRoomCode(code)}:${seatId}`)
    .digest("base64url");
}

function isValidSeatCookieSignature(
  code: string,
  seatId: string,
  signature: string,
) {
  const expectedSignature = signRoomSeatCookie(code, seatId);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function createRoomSeatCookieValue(code: string, seatId: string) {
  return `${ROOM_SEAT_COOKIE_VERSION}.${seatId}.${signRoomSeatCookie(code, seatId)}`;
}

export function getBoundSeatIdFromCookies(
  cookieStore: CookieReader,
  code: string,
) {
  const cookieValue = cookieStore.get(getRoomSeatCookieName(code))?.value;
  if (!cookieValue) {
    return null;
  }

  const [version, seatId, signature, ...rest] = cookieValue.split(".");
  if (
    version !== ROOM_SEAT_COOKIE_VERSION ||
    !seatId ||
    !signature ||
    rest.length > 0
  ) {
    return null;
  }

  return isValidSeatCookieSignature(code, seatId, signature) ? seatId : null;
}

export function bindSeatCookie(
  cookieStore: CookieWriter,
  code: string,
  seatId: string,
) {
  cookieStore.set(getRoomSeatCookieName(code), createRoomSeatCookieValue(code, seatId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
