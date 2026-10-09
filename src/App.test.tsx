import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(screen.getByText(/You save/)).toHaveTextContent(`You save NPR ${money(s.interestSaved)} and finish ${60 - n} months early`);
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

test("compare tab highlights the cheaper loan", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("tab", { name: "Compare" }));
  const rate = screen.getByLabelText("Loan B interest rate (% per year)");
  await userEvent.clear(rate);
  await userEvent.type(rate, "8");
  const table = screen.getByRole("table", { name: "Loan comparison" });
  expect(table).toHaveTextContent("Total cost");
  expect(screen.getByRole("columnheader", { name: /Loan B.*cheaper/ })).toBeInTheDocument();
});

test("compare tab shows an error for invalid input", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("tab", { name: "Compare" }));
  const months = screen.getByLabelText("Loan A tenure (months)");
  await userEvent.clear(months);
  await userEvent.type(months, "0");
  expect(screen.getByRole("alert")).toHaveTextContent("Tenure");
});

test("shows full monthly cost breakdown with tax, insurance and fees", async () => {
  render(<App />);
  expect(screen.queryByLabelText("Full monthly cost")).toBeNull();
  await userEvent.type(screen.getByLabelText("Yearly property tax (NPR)"), "1200");
  await userEvent.type(screen.getByLabelText("Yearly insurance (NPR)"), "600");
  await userEvent.type(screen.getByLabelText("Monthly fees (NPR)"), "25");
  const cost = screen.getByLabelText("Full monthly cost");
  const emi = calculateEmi(500000, 12, 60).emi;
  expect(cost).toHaveTextContent(`Total monthly cost: NPR ${money(emi + 175)}`);
  expect(cost).toHaveTextContent("Property tax: NPR 100.00");
  expect(cost).toHaveTextContent("Insurance: NPR 50.00");
  expect(cost).toHaveTextContent("Fees: NPR 25.00");
});

test.each([
  ["Loan amount (NPR)", "Loan amount slider", "250000", "750000"],
  ["Interest rate (% per year)", "Interest rate slider", "8.5", "15.5"],
  ["Tenure (months)", "Tenure slider", "120", "36"],
])("%s number field and slider stay in sync", async (label, sliderName, value, dragged) => {
  render(<App />);
  const field = screen.getByLabelText(label);
  const slider = screen.getByRole("slider", { name: sliderName });
  await userEvent.clear(field);
  await userEvent.type(field, value);
  expect(slider).toHaveValue(value);
  fireEvent.change(slider, { target: { value: dragged } });
  expect(field).toHaveValue(dragged);
});

test("slider drag updates the results card live", () => {
  render(<App />);
  fireEvent.change(screen.getByRole("slider", { name: "Tenure slider" }), { target: { value: "120" } });
  expect(screen.getByLabelText("Summary")).toHaveTextContent(`NPR ${money(calculateEmi(500000, 12, 120).emi)}`);
});

test("results card shows interest, total cost and payoff date", () => {
  render(<App />);
  const card = screen.getByLabelText("Summary");
  const r = calculateEmi(500000, 12, 60);
  expect(card).toHaveTextContent(`Total interest: NPR ${money(r.totalInterest)}`);
  expect(card).toHaveTextContent(`Total payment: NPR ${money(r.totalPayment)}`);
  expect(card).toHaveTextContent(/Payoff date: \w+ \d{4}/);
});

test("advanced options are collapsed by default and hold extra, lump, tax, insurance and fees", async () => {
  render(<App />);
  const details = screen.getByText("Advanced").closest("details")!;
  expect(details).not.toHaveAttribute("open");
  ["Monthly extra payment (NPR)", "One-time lump sum (NPR)", "Lump sum month", "Yearly property tax (NPR)", "Yearly insurance (NPR)", "Monthly fees (NPR)"]
    .forEach((l) => expect(details).toContainElement(screen.getByLabelText(l)));
  expect(details).not.toContainElement(screen.getByLabelText("Loan amount (NPR)"));
  await userEvent.click(screen.getByText("Advanced"));
  expect(details).toHaveAttribute("open");
});

test("tabs form a segmented control: Calculator, Affordability, Compare", () => {
  render(<App />);
  expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Calculator", "Affordability", "Compare"]);
  expect(screen.getByRole("tablist")).toHaveClass("segmented");
  expect(screen.getByRole("tab", { name: "Calculator" })).toHaveAttribute("aria-selected", "true");
});

test("savings badge shows the final value without animation when reduced motion is preferred", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} }));
  render(<App />);
  await userEvent.type(screen.getByLabelText("Monthly extra payment (NPR)"), "5000");
  const s = extraSavings(500000, 12, 60, { monthly: 5000 });
  expect(screen.getByRole("status", { name: /You save/ })).toHaveTextContent(`NPR ${money(s.interestSaved)}`);
  vi.unstubAllGlobals();
});

test("savings badge counts up to the final value when motion is allowed", async () => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  // Deterministic frames: each frame jumps past the 800 ms animation, so slow CI machines can't time out.
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now() + 1000), 0) as unknown as number);
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  render(<App />);
  await userEvent.type(screen.getByLabelText("Monthly extra payment (NPR)"), "5000");
  const s = extraSavings(500000, 12, 60, { monthly: 5000 });
  const badge = screen.getByRole("status", { name: /You save/ });
  expect(badge).toHaveAccessibleName(`You save NPR ${money(s.interestSaved)} and finish ${s.monthsSaved} months early`);
  await vi.waitFor(() => expect(badge).toHaveTextContent(`NPR ${money(s.interestSaved)}`));
  vi.unstubAllGlobals();
});

test("results card shows donut chart with legend", () => {
  render(<App />);
  const summary = screen.getByLabelText("Summary");
  const donut = within(summary).getByRole("img", { name: /principal .*% and interest .*%/i });
  expect(donut.querySelectorAll("circle[data-arc]")).toHaveLength(2);
  expect(within(summary).getByText(/^Principal \d/)).toBeInTheDocument();
  expect(within(summary).getByText(/^Interest \d/)).toBeInTheDocument();
});

test("balance chart shows value tooltip on hover and focus", async () => {
  render(<App />);
  const pts = screen.getAllByTestId("chart-point");
  expect(screen.queryByRole("tooltip")).toBeNull();
  await userEvent.hover(pts[1]);
  expect(screen.getByRole("tooltip")).toHaveTextContent(/Year 1/);
  await userEvent.unhover(pts[1]);
  expect(screen.queryByRole("tooltip")).toBeNull();
  act(() => pts[2].focus());
  expect(screen.getByRole("tooltip")).toHaveTextContent(/Year 2/);
});

test("schedule table is sticky and zebra striped", () => {
  render(<App />);
  expect(screen.getByRole("table", { name: "Monthly payment schedule" }).closest(".schedule")).not.toBeNull();
});

test("shows milestones timeline and highlights extra-payment gains", async () => {
  render(<App />);
  const section = screen.getByLabelText("Debt-free milestones");
  expect(within(section).getAllByRole("listitem")).toHaveLength(4);
  expect(section).toHaveTextContent("Debt-free");
  expect(section).not.toHaveTextContent("months earlier");
  await userEvent.click(screen.getByText("Advanced"));
  await userEvent.type(screen.getByLabelText("Monthly extra payment (NPR)"), "10000");
  expect(screen.getByLabelText("Debt-free milestones")).toHaveTextContent("months earlier");
});

test.each(["EMI", "interest rate", "tenure", "amortization", "prepayment"])("info button explains %s in an accessible popover", async (term) => {
  render(<App />);
  if (term === "prepayment") await userEvent.click(screen.getByText("Advanced"));
  const btn = screen.getByRole("button", { name: `What is ${term}?` });
  expect(btn).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(btn);
  expect(btn).toHaveAttribute("aria-expanded", "true");
  const pop = screen.getByRole("note");
  expect(btn).toHaveAttribute("aria-controls", pop.id);
  expect(pop.textContent!.length).toBeGreaterThan(20);
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(btn).toHaveFocus();
});
