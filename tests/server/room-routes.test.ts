import { POST as postMessage } from "@/app/api/rooms/[code]/message/route";
import { POST as postVote } from "@/app/api/rooms/[code]/vote/route";

describe("room routes", () => {
  it("returns 400 for malformed message JSON", async () => {
    const response = await postMessage(
      new Request("http://localhost/api/rooms/ABCDEF/message", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{",
      }),
      {
        params: Promise.resolve({
          code: "ABCDEF",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_REQUEST_BODY",
    });
  });

  it("returns 400 for malformed vote body shape", async () => {
    const response = await postVote(
      new Request("http://localhost/api/rooms/ABCDEF/vote", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          voterSeatId: "seat-2",
        }),
      }),
      {
        params: Promise.resolve({
          code: "ABCDEF",
        }),
      },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "INVALID_REQUEST_BODY",
    });
  });
});
