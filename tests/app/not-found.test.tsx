import { afterEach, describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import NotFound from "@/app/not-found";

describe("NotFound", () => {
  afterEach(() => {
    redirectMock.mockReset();
  });

  it("redirects missing routes back to the home page", async () => {
    await NotFound();

    expect(redirectMock).toHaveBeenCalledWith("/");
  });
});
