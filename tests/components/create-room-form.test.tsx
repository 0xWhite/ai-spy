import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateRoomForm } from "@/components/create-room-form";

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

it("submits the default room config", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);

  render(<CreateRoomForm onCreate={onCreate} />);

  await user.click(screen.getByRole("button", { name: "创建房间" }));

  expect(onCreate).toHaveBeenCalledWith({
    totalSeats: 7,
    aiCount: 1,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });
});

it("creates a room through the API and navigates to the room when no handler is provided", async () => {
  const user = userEvent.setup();
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      code: "ABCDEF",
    }),
  });

  useRouterMock.mockReturnValue({
    push: pushMock,
  });
  vi.stubGlobal("fetch", fetchMock);

  render(<CreateRoomForm />);

  await user.click(screen.getByRole("button", { name: "创建房间" }));

  expect(fetchMock).toHaveBeenCalledWith("/api/rooms", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      totalSeats: 7,
      aiCount: 1,
      roundOneSeconds: 300,
      roundSeconds: 180,
    }),
  });
  expect(pushMock).toHaveBeenCalledWith("/room/ABCDEF");
});

it("updates room config through the stepper controls", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);

  render(<CreateRoomForm onCreate={onCreate} />);

  await user.click(screen.getByRole("button", { name: "总人数增加" }));
  await user.click(screen.getByRole("button", { name: "AI 数量增加" }));
  await user.click(screen.getByRole("button", { name: "创建房间" }));

  expect(onCreate).toHaveBeenCalledWith({
    totalSeats: 8,
    aiCount: 2,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });
});

it("keeps stepper hover targets constrained to the button itself", () => {
  render(<CreateRoomForm onCreate={vi.fn()} />);

  const decreaseButton = screen.getByRole("button", { name: "总人数减少" });
  const increaseButton = screen.getByRole("button", { name: "总人数增加" });

  expect(decreaseButton.className).not.toContain("absolute");
  expect(decreaseButton.className).not.toContain("inset-0");
  expect(increaseButton.className).not.toContain("absolute");
  expect(increaseButton.className).not.toContain("inset-0");

  expect(decreaseButton.parentElement?.className).not.toContain("pointer-events-none");
  expect(increaseButton.parentElement?.className).not.toContain("pointer-events-none");
  expect(decreaseButton.closest("label")).toBeNull();
  expect(increaseButton.closest("label")).toBeNull();
});
