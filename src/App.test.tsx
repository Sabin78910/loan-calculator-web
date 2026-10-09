import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { breakdown, calculateEmi } from "./emi";

beforeEach(() => window.history.replaceState(null, "", "/"));

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

test("shows principal vs interest breakdown with percentages", () => {
  render(<App />);
  const bar = screen.getByRole("img", { name: /principal .*% and interest .*%/i });
  const { principalPct, interestPct } = breakdown(calculateEmi(500000, 12, 60), 500000);
  expect(bar).toHaveAttribute("aria-label", `Principal ${principalPct.toFixed(1)}% and interest ${interestPct.toFixed(1)}% of total payment`);
  expect(screen.getByText(`Principal ${principalPct.toFixed(1)}%`)).toBeInTheDocument();
  expect(screen.getByText(`Interest ${interestPct.toFixed(1)}%`)).toBeInTheDocument();
});

test("loads inputs from URL and syncs changes back", async () => {
  window.history.replaceState(null, "", "?principal=100000&rate=10&months=12");
  render(<App />);
  expect(screen.getByLabelText("Loan amount (NPR)")).toHaveValue("100000");
  const months = screen.getByLabelText("Tenure (months)");
  await userEvent.clear(months);
  await userEvent.type(months, "24");
  expect(window.location.search).toBe("?principal=100000&rate=10&months=24");
});
