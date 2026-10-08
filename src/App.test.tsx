import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

test("shows EMI and validation error", async () => {
  render(<App />);
  expect(screen.getByLabelText("Summary")).toHaveTextContent("Monthly EMI");
  const months = screen.getByLabelText("Tenure (months)");
  await userEvent.clear(months);
  await userEvent.type(months, "0");
  expect(screen.getByRole("alert")).toHaveTextContent("Tenure must be at least 1 month");
});

test("download CSV button saves loan-schedule.csv", async () => {
  const createObjectURL = vi.fn(() => "blob:x");
  const revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  let name = "";
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { name = this.download; });
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Download CSV" }));
  expect(name).toBe("loan-schedule.csv");
  expect(createObjectURL).toHaveBeenCalledTimes(1);
  click.mockRestore();
});
