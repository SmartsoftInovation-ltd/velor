import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import RecentSalesTable, { avatarTone, initials, saleDate } from "./RecentSalesTable";
import type { RecentSale } from "./useDashboard";

const sale = (over: Partial<RecentSale> = {}): RecentSale => ({
  invoiceNumber: "#ORD-9821",
  payable: 2450,
  paid: 2450,
  presentDue: 0,
  paymentStatus: "paid",
  salesType: "retail",
  customerName: "Ashfaq Rahman",
  createdAt: "2026-11-05T10:00:00.000Z",
  ...over,
});

describe("RecentSalesTable", () => {
  it("shows the invoice, customer with initials, date, amount and status", () => {
    render(<RecentSalesTable sales={[sale()]} />);
    const row = within(screen.getAllByRole("row")[1]);
    expect(row.getByText("#ORD-9821")).toBeTruthy();
    expect(row.getByText("AR")).toBeTruthy();
    expect(row.getByText("Ashfaq Rahman")).toBeTruthy();
    expect(row.getByText("05 Nov, 2026")).toBeTruthy();
    expect(row.getAllByText("৳2,450")).toHaveLength(2);
    expect(row.getByText("paid")).toBeTruthy();
  });

  it("shows payable, paid and due as separate columns", () => {
    render(<RecentSalesTable sales={[sale({ payable: 2730, paid: 1000, presentDue: 1730, paymentStatus: "partial" })]} />);
    ["Payable", "Paid", "Due"].forEach((name) => expect(screen.getByRole("columnheader", { name })).toBeTruthy());
    const row = within(screen.getAllByRole("row")[1]);
    expect(row.getByText("৳2,730")).toBeTruthy();
    expect(row.getByText("৳1,000")).toBeTruthy();
    expect(row.getByText("৳1,730")).toBeTruthy();
  });

  it("makes initials from one word, many words, or no name", () => {
    expect(initials("Tanvir")).toBe("T");
    expect(initials("  Nusrat  Jahan Sultana ")).toBe("NJ");
    expect(initials("")).toBe("?");
  });

  it("gives a customer the same avatar color every time", () => {
    expect(avatarTone("Tanvir Khan")).toBe(avatarTone("Tanvir Khan"));
  });

  it("does not print a broken date", () => {
    expect(saleDate("not a date")).toBe("—");
  });
});
