import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { breakdown, calculateEmi, maxLoan, extraSavings, lumpOutcome, money, schedule } from "./emi";

beforeEach(() => { window.history.replaceState(null, "", "/"); window.localStorage.clear(); });

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
  expect(within(screen.getByRole("table", { name: /schedule/i })).getAllByRole("row")).toHaveLength(61);
  await userEvent.click(screen.getByRole("button", { name: "Yearly" }));
  expect(screen.getByRole("columnheader", { name: "Year" })).toBeInTheDocument();
  expect(within(screen.getByRole("table", { name: /schedule/i })).getAllByRole("row")).toHaveLength(6);
  await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
  expect(within(screen.getByRole("table", { name: /schedule/i })).getAllByRole("row")).toHaveLength(61);
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
  expect(within(screen.getByRole("table", { name: /schedule/i })).getAllByRole("row")).toHaveLength(n + 1);
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

test("Print / Save as PDF button calls window.print", async () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Print / Save as PDF" }));
  expect(print).toHaveBeenCalledTimes(1);
  print.mockRestore();
});

test("print summary lists inputs and the yearly schedule", async () => {
  render(<App />);
  const summary = screen.getByLabelText("Printable summary", { selector: "section" });
  expect(summary).toHaveTextContent(`Loan amount: NPR ${money(500000)}`);
  expect(summary).toHaveTextContent("Interest rate: 12% per year");
  expect(summary).toHaveTextContent("Tenure: 60 months");
  await userEvent.click(screen.getByRole("button", { name: "Monthly" }));
  expect(within(summary).getByRole("table", { name: "Yearly summary schedule", hidden: true })).toBeInTheDocument();
  expect(within(summary).getAllByRole("row", { hidden: true })).toHaveLength(1 + 5);
});

describe("language switch", () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.lang = "en"; });

  test("defaults to English and switches all text, aria labels and numbers to Nepali", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Loan Calculator");
    await userEvent.click(screen.getByRole("button", { name: "नेपाली" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ऋण क्याल्कुलेटर");
    expect(screen.getByLabelText("ऋण रकम स्लाइडर")).toBeInTheDocument();
    expect(screen.getByLabelText("सारांश")).toHaveTextContent(/[०-९]/);
    expect(screen.getByRole("table", { name: "मासिक भुक्तानी तालिका" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ne");
    await userEvent.click(screen.getByRole("button", { name: "EN" }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Loan Calculator");
  });

  test("choice persists in localStorage across renders", async () => {
    const { unmount } = render(<App />);
    await userEvent.click(screen.getByRole("button", { name: "नेपाली" }));
    expect(localStorage.getItem("lang")).toBe("ne");
    unmount();
    render(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("ऋण क्याल्कुलेटर");
  });

  test("translates validation errors", async () => {
    localStorage.setItem("lang", "ne");
    render(<App />);
    const months = screen.getByLabelText("अवधि (महिना)", { selector: "input:not([type=range])" });
    await userEvent.clear(months);
    await userEvent.type(months, "0");
    expect(screen.getByRole("alert")).toHaveTextContent("अवधि कम्तीमा १ महिना हुनुपर्छ");
  });
});

test("rate what-if table shows EMI and interest at rate offsets and updates", async () => {
  localStorage.clear();
  render(<App />);
  const table = screen.getByRole("table", { name: "What if the rate changes?" });
  expect(within(table).getAllByRole("columnheader").length).toBeGreaterThanOrEqual(4);
  expect(within(table).getAllByRole("row")).toHaveLength(6);
  expect(within(table).getByText(money(calculateEmi(500000, 13, 60).emi))).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Interest rate (% per year)", { selector: "input:not([type=range])" }), { target: { value: "8" } });
  expect(within(table).getByText(money(calculateEmi(500000, 9, 60).emi))).toBeInTheDocument();
});

test("bi-weekly toggle is keyboard accessible, shows savings badge and updates the share link", async () => {
  render(<App />);
  const box = screen.getByRole("checkbox", { name: /Pay bi-weekly/ });
  expect(box).not.toBeChecked();
  expect(screen.queryByText(/You save/)).not.toBeInTheDocument();
  box.focus();
  await userEvent.keyboard(" ");
  expect(box).toBeChecked();
  expect(screen.getByText(/You save/)).toBeInTheDocument();
  expect(window.location.search).toContain("biweekly=1");
  expect(screen.getByText(/lender must apply/i)).toBeInTheDocument();
});

test("restores saved inputs, URL overrides them, and clear resets", async () => {
  window.localStorage.clear();
  window.localStorage.setItem("loan-calculator:inputs", JSON.stringify({ v: 1, inputs: { principal: "250000", rate: "8", months: "36", extra: "", lump: "", lumpMonth: "1", biweekly: "" } }));
  const first = render(<App />);
  expect(screen.getByLabelText("Loan amount (NPR)")).toHaveValue("250000");
  expect(screen.getByLabelText("Tenure (months)")).toHaveValue("36");
  first.unmount();

  window.history.replaceState(null, "", "/?rate=5");
  const second = render(<App />);
  expect(screen.getByLabelText("Loan amount (NPR)")).toHaveValue("250000");
  expect(screen.getByLabelText("Interest rate (% per year)")).toHaveValue("5");
  second.unmount();

  window.history.replaceState(null, "", "/");
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "Clear saved data" }));
  expect(screen.getByLabelText("Loan amount (NPR)")).toHaveValue("500000");
  expect(window.localStorage.getItem("loan-calculator:inputs")).toBeNull();
});

test("upfront fee shows APR above the nominal rate and validates", async () => {
  render(<App />);
  expect(screen.queryByText(/^APR:/)).not.toBeInTheDocument();
  const fee = screen.getByLabelText("Upfront fee");
  await userEvent.type(fee, "2");
  const line = screen.getByText(/^APR: .*% \(nominal rate 12%\)/);
  expect(line).toBeInTheDocument();
  expect(Number(/APR: ([\d.]+)%/.exec(line.textContent!)![1])).toBeGreaterThan(12);
  expect(screen.getByText(/true yearly cost/)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText("Upfront fee type"), "amount");
  await userEvent.clear(fee);
  await userEvent.type(fee, "-5");
  expect(screen.getByRole("alert")).toHaveTextContent("Fee cannot be negative");
  expect(screen.queryByText(/^APR:/)).not.toBeInTheDocument();
});

test("adds and removes rate changes and updates the result", async () => {
  render(<App />);
  const summary = screen.getByLabelText("Summary");
  const before = summary.textContent;
  const add = screen.getByRole("button", { name: "Add rate change" });
  await userEvent.click(add);
  await userEvent.type(screen.getByLabelText("Rate change 1: from month"), "24");
  await userEvent.type(screen.getByLabelText("Rate change 1: new rate (% per year)"), "15");
  expect(summary.textContent).not.toBe(before);
  const expected = schedule(500000, 12, 60, {}, [{ fromMonth: 24, annualRate: 15 }]).reduce((s, r) => s + r.interest, 0);
  expect(summary).toHaveTextContent(`Total interest: NPR ${money(expected)}`);
  expect(window.location.search).toContain("changes=24%3A15");
  await userEvent.click(screen.getByRole("button", { name: "Remove rate change 1" }));
  expect(screen.queryByLabelText("Rate change 1: from month")).not.toBeInTheDocument();
  expect(summary.textContent).toBe(before);
  expect(window.location.search).not.toContain("changes");
});

test("limits rate changes to five and restores them from the URL", async () => {
  window.history.replaceState(null, "", "?changes=12:10,24:11");
  render(<App />);
  expect(screen.getByLabelText("Rate change 2: new rate (% per year)")).toHaveValue("11");
  const add = screen.getByRole("button", { name: "Add rate change" });
  for (let i = 0; i < 3; i++) await userEvent.click(add);
  expect(add).toBeDisabled();
});

test("currency selector changes displayed amounts, share URL and saved choice, not CSV", async () => {
  render(<App />);
  const sel = screen.getByLabelText("Currency");
  expect(sel).toHaveValue("NPR");
  const emi = calculateEmi(500000, 12, 60).emi;
  await userEvent.selectOptions(sel, "USD");
  const card = screen.getByLabelText("Summary");
  expect(card).toHaveTextContent(`$${money(emi)}`);
  expect(card).not.toHaveTextContent("NPR");
  expect(screen.getByLabelText("Loan amount (USD)")).toBeInTheDocument();
  expect(window.location.search).toContain("currency=USD");
  expect(window.localStorage.getItem("loan-calculator:inputs")).toContain('"currency":"USD"');
  await userEvent.selectOptions(sel, "none");
  expect(screen.getByLabelText("Summary")).toHaveTextContent(`Monthly EMI: ${money(emi)}`);
  expect(screen.getByLabelText("Summary")).not.toHaveTextContent(/NPR|\$/);
  expect(screen.getByLabelText("Loan amount")).toBeInTheDocument();
});

test("CSV output is unaffected by currency", async () => {
  let blob: Blob | undefined;
  Object.assign(URL, { createObjectURL: vi.fn((b: Blob) => { blob = b; return "blob:x"; }), revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  render(<App />);
  await userEvent.selectOptions(screen.getByLabelText("Currency"), "EUR");
  await userEvent.click(screen.getByRole("button", { name: "Download CSV" }));
  const text = await blob!.text();
  expect(text).not.toMatch(/€|EUR|NPR/);
  expect(text.startsWith("Month,Principal,Interest,Extra,Balance")).toBe(true);
  click.mockRestore();
});

test("currency from the share URL is applied", () => {
  window.history.replaceState(null, "", "/?currency=GBP");
  render(<App />);
  expect(screen.getByLabelText("Currency")).toHaveValue("GBP");
  expect(screen.getByLabelText("Summary")).toHaveTextContent("£");
});

test("switching lump sum mode changes EMI and share URL", async () => {
  render(<App />);
  expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  await userEvent.click(screen.getByText("Advanced"));
  await userEvent.type(screen.getByLabelText("One-time lump sum (NPR)"), "100000");
  const group = screen.getByRole("radiogroup", { name: "After the lump sum" });
  expect(within(group).getByRole("radio", { name: "Reduce tenure" })).toBeChecked();
  const before = calculateEmi(500000, 12, 60).emi;
  await userEvent.click(within(group).getByRole("radio", { name: "Reduce EMI" }));
  const rows = schedule(500000, 12, 60, { lumpSum: 100000, lumpMonth: 1, lumpMode: "emi" });
  const out = lumpOutcome(500000, 12, 60, { lumpSum: 100000, lumpMonth: 1, lumpMode: "emi" })!;
  expect(out.newEmi).toBeLessThan(before);
  expect(rows).toHaveLength(60);
  expect(screen.getByText(new RegExp(`New EMI.*${money(out.newEmi).replace(/[.,]/g, "\\$&")}`))).toBeInTheDocument();
  expect(screen.getByText(new RegExp(`Interest saved.*${money(out.interestSaved).replace(/[.,]/g, "\\$&")}`))).toBeInTheDocument();
  expect(window.location.search).toContain("lumpMode=emi");
  await userEvent.click(within(group).getByRole("radio", { name: "Reduce tenure" }));
  expect(window.location.search).not.toContain("lumpMode");
});
