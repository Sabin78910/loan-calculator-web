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

test("shows principal vs interest breakdown bar", () => {
  render(<App />);
  const bar = screen.getByRole("img", { name: /principal .*interest/i });
  expect(bar).toBeInTheDocument();
  expect(screen.getByText(/Principal: 74\.9\s*%/)).toBeInTheDocument();
  expect(screen.getByText(/Interest: 25\.1\s*%/)).toBeInTheDocument();
});
