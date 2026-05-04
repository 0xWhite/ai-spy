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

it("preserves defaults when numeric fields are left blank", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);

  render(<CreateRoomForm onCreate={onCreate} />);

  await user.clear(screen.getByLabelText("总人数"));
  await user.clear(screen.getByLabelText("AI 数量"));
  await user.click(screen.getByRole("button", { name: "创建房间" }));

  expect(onCreate).toHaveBeenCalledWith({
    totalSeats: 7,
    aiCount: 1,
    roundOneSeconds: 300,
    roundSeconds: 180,
  });
});
