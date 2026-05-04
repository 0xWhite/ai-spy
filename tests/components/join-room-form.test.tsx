import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinRoomForm } from "@/components/join-room-form";

const { pushMock, useRouterMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  useRouterMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: useRouterMock,
}));

afterEach(() => {
  pushMock.mockReset();
  useRouterMock.mockReset();
  vi.unstubAllGlobals();
});

it("submits the normalized invite code", async () => {
  const user = userEvent.setup();
  const onJoin = vi.fn().mockResolvedValue(undefined);

  render(<JoinRoomForm onJoin={onJoin} />);

  await user.type(screen.getByLabelText("邀请码"), "ab c123");
  await user.click(screen.getByRole("button", { name: "加入房间" }));

  expect(onJoin).toHaveBeenCalledWith({ code: "ABC123" });
});

it("does not submit malformed normalized invite codes", async () => {
  const user = userEvent.setup();
  const onJoin = vi.fn().mockResolvedValue(undefined);

  render(<JoinRoomForm onJoin={onJoin} />);

  await user.type(screen.getByLabelText("邀请码"), "ab 12");
  await user.click(screen.getByRole("button", { name: "加入房间" }));

  expect(onJoin).not.toHaveBeenCalled();
});

it("joins through the API and navigates to the room when no handler is provided", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: "ABC123",
    }),
  });

  useRouterMock.mockReturnValue({
    push: pushMock,
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<JoinRoomForm />);

  await user.type(screen.getByLabelText("邀请码"), "ab c123");
  await user.click(screen.getByRole("button", { name: "加入房间" }));

  expect(fetchMock).toHaveBeenCalledWith("/api/rooms/ABC123/join", {
    method: "POST",
  });
  expect(pushMock).toHaveBeenCalledWith("/room/ABC123");
});
