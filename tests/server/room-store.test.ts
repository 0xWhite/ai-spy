import { InMemoryRoomStore } from "@/lib/server/room-store";

describe("room store", () => {
  it("createRoom returns an initial waiting snapshot with a 6-character code", () => {
    const store = new InMemoryRoomStore();

    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });

    expect(room.code).toMatch(/^[A-Z]{6}$/);
    expect(room.phase).toBe("waiting");
    expect(room.hostSeatId).toBe("seat-1");
  });

  it("broadcasts to room subscribers when a player joins", () => {
    const store = new InMemoryRoomStore();
    const room = store.createRoom({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(room.code, listener);
    const updatedRoom = store.joinRoom(room.code);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(updatedRoom);
    expect(updatedRoom.seats.find((seat) => seat.id === "seat-2")?.connected).toBe(
      true,
    );

    unsubscribe();
  });
});
