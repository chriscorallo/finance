import { describe, it, expect } from "vitest";
import { calculateNetWorth, isLiabilityAccountType } from "./net-worth";

describe("isLiabilityAccountType", () => {
  it("classifies credit cards and loans as liabilities", () => {
    expect(isLiabilityAccountType("credit_card")).toBe(true);
    expect(isLiabilityAccountType("loan_mortgage")).toBe(true);
    expect(isLiabilityAccountType("other_liability")).toBe(true);
  });

  it("classifies everything else as an asset", () => {
    expect(isLiabilityAccountType("checking")).toBe(false);
    expect(isLiabilityAccountType("brokerage")).toBe(false);
    expect(isLiabilityAccountType("real_estate")).toBe(false);
  });
});

describe("calculateNetWorth", () => {
  it("returns all zeros for no accounts", () => {
    expect(calculateNetWorth([])).toEqual({
      totalAssetsCents: 0,
      totalLiabilitiesCents: 0,
      netWorthCents: 0,
      liquidNetWorthCents: 0,
    });
  });

  it("subtracts liabilities from assets", () => {
    const result = calculateNetWorth([
      { accountType: "checking", currentBalanceCents: 500_00, includeInNetWorth: true, includeInLiquidNetWorth: true },
      { accountType: "credit_card", currentBalanceCents: 200_00, includeInNetWorth: true, includeInLiquidNetWorth: false },
    ]);

    expect(result.totalAssetsCents).toBe(500_00);
    expect(result.totalLiabilitiesCents).toBe(200_00);
    expect(result.netWorthCents).toBe(300_00);
  });

  it("treats a liability balance as a positive magnitude, not a stored negative", () => {
    // Storing -200 for a credit card balance should not double-negate.
    const result = calculateNetWorth([
      { accountType: "credit_card", currentBalanceCents: -200_00, includeInNetWorth: true, includeInLiquidNetWorth: false },
    ]);
    expect(result.totalLiabilitiesCents).toBe(200_00);
    expect(result.netWorthCents).toBe(-200_00);
  });

  it("excludes accounts with includeInNetWorth = false entirely", () => {
    const result = calculateNetWorth([
      { accountType: "real_estate", currentBalanceCents: 400_000_00, includeInNetWorth: false, includeInLiquidNetWorth: false },
      { accountType: "checking", currentBalanceCents: 1_000_00, includeInNetWorth: true, includeInLiquidNetWorth: true },
    ]);
    expect(result.totalAssetsCents).toBe(1_000_00);
    expect(result.netWorthCents).toBe(1_000_00);
  });

  it("computes liquid net worth separately from total net worth", () => {
    const result = calculateNetWorth([
      { accountType: "checking", currentBalanceCents: 1_000_00, includeInNetWorth: true, includeInLiquidNetWorth: true },
      { accountType: "real_estate", currentBalanceCents: 300_000_00, includeInNetWorth: true, includeInLiquidNetWorth: false },
      { accountType: "credit_card", currentBalanceCents: 200_00, includeInNetWorth: true, includeInLiquidNetWorth: true },
    ]);

    expect(result.netWorthCents).toBe(1_000_00 + 300_000_00 - 200_00);
    expect(result.liquidNetWorthCents).toBe(1_000_00 - 200_00);
  });
});
