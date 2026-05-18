import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

const { useRouterMock } = vi.hoisted(() => ({
  useRouterMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

describe("HomePage", () => {
  afterEach(() => {
    useRouterMock.mockReset();
  });

  it("shows a join error message and preserves the invite code from the query string", async () => {
    useRouterMock.mockReturnValue({
      push: vi.fn(),
    });

    const result = await HomePage({
      searchParams: Promise.resolve({
        code: "JBGHLD",
        error: "seat-required",
      }),
    });

    render(result);

    expect(
      screen.getByText("请先通过首页的邀请码加入房间，再进入游戏。"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("邀请码")).toHaveValue("JBGHLD");
  });
});
