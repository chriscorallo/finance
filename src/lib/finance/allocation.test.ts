import { describe, it, expect } from "vitest";
import { bucketAssets, bucketLiabilities, sortByCentsDescending } from "./allocation";

describe("bucketAssets", () => {
  it("groups checking/savings/money_market into Cash", () => {
    const result = bucketAssets([
      { accountType: "checking", currentBalanceCents: 1_000_00, includeInNetWorth: true },
      { accountType: "savings", currentBalanceCents: 2_000_00, includeInNetWorth: true },
      { accountType: "money_market", currentBalanceCents: 500_00, includeInNetWorth: true },
    ]);
    expect(result).toEqual([{ key: "cash", label: "Cash", colorVar: "--series-1", cents: 3_500_00 }]);
  });

  it("excludes accounts with includeInNetWorth = false", () => {
    const result = bucketAssets([
      { accountType: "checking", currentBalanceCents: 1_000_00, includeInNetWorth: false },
    ]);
    expect(result).toEqual([]);
  });

  it("omits empty buckets entirely rather than showing a zero bar", () => {
    const result = bucketAssets([{ accountType: "checking", currentBalanceCents: 1_000_00, includeInNetWorth: true }]);
    expect(result.map((b) => b.key)).toEqual(["cash"]);
  });

  it("separates brokerage/retirement/crypto into Investments and real_estate/vehicle into Property", () => {
    const result = bucketAssets([
      { accountType: "brokerage", currentBalanceCents: 10_000_00, includeInNetWorth: true },
      { accountType: "real_estate", currentBalanceCents: 400_000_00, includeInNetWorth: true },
    ]);
    expect(result).toContainEqual({ key: "investments", label: "Investments", colorVar: "--series-3", cents: 10_000_00 });
    expect(result).toContainEqual({ key: "property", label: "Property", colorVar: "--series-4", cents: 400_000_00 });
  });
});

describe("bucketLiabilities", () => {
  it("shares one color across all liability buckets, differing only by label", () => {
    const result = bucketLiabilities([
      { accountType: "credit_card", currentBalanceCents: 200_00, includeInNetWorth: true },
      { accountType: "loan_auto", currentBalanceCents: 15_000_00, includeInNetWorth: true },
    ]);
    expect(result.every((b) => b.colorVar === "--negative")).toBe(true);
    expect(result.map((b) => b.label).sort()).toEqual(["Credit cards", "Loans"]);
  });

  it("treats a negative-stored balance as a positive magnitude", () => {
    const result = bucketLiabilities([
      { accountType: "credit_card", currentBalanceCents: -500_00, includeInNetWorth: true },
    ]);
    expect(result).toEqual([{ key: "credit_cards", label: "Credit cards", colorVar: "--negative", cents: 500_00 }]);
  });
});

describe("sortByCentsDescending", () => {
  it("sorts largest first without mutating the input", () => {
    const input = [
      { key: "a", label: "A", colorVar: "--series-1", cents: 100 },
      { key: "b", label: "B", colorVar: "--series-2", cents: 300 },
    ];
    const sorted = sortByCentsDescending(input);
    expect(sorted.map((b) => b.key)).toEqual(["b", "a"]);
    expect(input.map((b) => b.key)).toEqual(["a", "b"]);
  });
});
