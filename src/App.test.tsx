import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { breakdown, calculateEmi, maxLoan, extraSavings, money, schedule } from "./emi";

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

test("toggles between monthly and yearly schedule", async () => {
  render(<App />);
  expect(screen.getAllByRole("row")).toHaveLength(61);
  await userEvent.click(screen.getByRole("button", { name: "Yearly" }));
  expect(screen.getByRole("columnheader", { name: "Year" })).toBeInTheDocument();
  expect(screen.getAllByRole("row")).toHaveLength(6);
  await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
  expect(screen.getAllByRole("row")).toHaveLength(61);
});

test("summary is a polite live region", () => {
  render(<App />);
  expect(screen.getByLabelText("Summary")).toHaveAttribute("aria-live", "polite");
});

test("tables have caption and column-scoped headers", async () => {
  render(<App />);
  expect(screen.getByRole("table", { name: "Monthly payment schedule" })).toBeInTheDocument();
  screen.getAllByRole("columnheader").forEach((h) => expect(h).toHaveAttribute("scope", "col"));
  await userEvent.click(screen.getByRole("button", { name: "Yearly" }));
  expect(screen.getByRole("table", { name: "Yearly payment schedule" })).toBeInTheDocument();
  screen.getAllByRole("columnheader").forEach((h) => expect(h).toHaveAttribute("scope", "col"));
});

test("invalid input is marked aria-invalid and linked to its error", async () => {
  render(<App />);
  const months = screen.getByLabelText("Tenure (months)");
  expect(months).not.toHaveAttribute("aria-invalid", "true");
  await userEvent.clear(months);
  await userEvent.type(months, "0");
  expect(months).toHaveAttribute("aria-invalid", "true");
  expect(months).toHaveAccessibleDescription("Tenure must be at least 1 month");
  expect(screen.getByLabelText("Loan amount (NPR)")).not.toHaveAttribute("aria-invalid", "true");
  const rate = screen.getByLabelText("Interest rate (% per year)");
  await userEvent.clear(rate);
  await userEvent.type(rate, "-1");
  await userEvent.clear(months);
  await userEvent.type(months, "12");
  expect(rate).toHaveAttribute("aria-invalid", "true");
  expect(rate).toHaveAccessibleDescription("Rate cannot be negative");
});

test("extra payments show savings and appear in the share link", async () => {
  render(<App />);
  expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
  await userEvent.type(screen.getByLabelText("Monthly extra payment (NPR)"), "5000");
  const n = schedule(500000, 12, 60, { monthly: 5000 }).length;
  const s = extraSavings(500000, 12, 60, { monthly: 5000 });
  expect(screen.getByText(/You save/)).toHaveTextContent(`You save NPR ${money(s.interestSaved)} interest and finish ${60 - n} months early`);
  expect(window.location.search).toContain("extra=5000");
  expect(screen.getAllByRole("row")).toHaveLength(n + 1);
});

test("lump sum month is validated", async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText("One-time lump sum (NPR)"), "10000");
  const m = screen.getByLabelText("Lump sum month");
  await userEvent.clear(m);
  await userEvent.type(m, "0");
  expect(screen.getByRole("alert")).toHaveTextContent("Extra");
});

test("affordability tab computes maximum loan", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("tab", { name: "Affordability" }));
  await userEvent.type(screen.getByLabelText("Maximum monthly payment (NPR)"), "25000");
  await userEvent.clear(screen.getByLabelText("Interest rate (% per year)"));
  await userEvent.type(screen.getByLabelText("Interest rate (% per year)"), "10");
  await userEvent.clear(screen.getByLabelText("Tenure (months)"));
  await userEvent.type(screen.getByLabelText("Tenure (months)"), "120");
  expect(screen.getByLabelText("Affordability result")).toHaveTextContent(`Maximum loan: NPR ${money(maxLoan(25000, 10, 120))}`);
});

test("renders balance chart as accessible img with text summary", () => {
  render(<App />);
  const chart = screen.getByRole("img", { name: /Loan balance over time/ });
  expect(chart).toHaveAccessibleName(/5 years/);
  expect(chart.querySelector("polyline")).not.toBeNull();
});
