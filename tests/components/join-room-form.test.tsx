import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JoinRoomForm } from "@/components/join-room-form";

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
