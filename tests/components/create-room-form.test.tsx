import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateRoomForm } from "@/components/create-room-form";

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
