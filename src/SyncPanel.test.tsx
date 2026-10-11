import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncPanel } from "./SyncPanel";

const base = { code: null, status: "off" as const, turnOn: vi.fn(), connectCode: vi.fn(), turnOff: vi.fn(), syncNow: vi.fn(), onCopied: vi.fn() };

test("off: shows Turn on and rejects an invalid code", async () => {
  const connectCode = vi.fn(() => false);
  render(<SyncPanel {...base} connectCode={connectCode} />);
  await userEvent.click(screen.getByRole("button", { name: "Turn on" }));
  expect(base.turnOn).toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Use a code" }));
  await userEvent.type(screen.getByLabelText(/Sync code from another device/), "bad");
  await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  expect(connectCode).toHaveBeenCalledWith("bad");
  expect(screen.getByRole("alert")).toHaveTextContent("not a valid sync code");
});

test("on: shows status chip and Copy / Sync now / Turn off", async () => {
  render(<SyncPanel {...base} code="SS1-x" status="synced" />);
  expect(screen.getByRole("status")).toHaveTextContent("Synced");
  await userEvent.click(screen.getByRole("button", { name: "Sync now" }));
  await userEvent.click(screen.getByRole("button", { name: "Turn off" }));
  expect(base.syncNow).toHaveBeenCalled();
  expect(base.turnOff).toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
});
