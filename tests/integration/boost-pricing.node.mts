import assert from "node:assert/strict";
import { test } from "node:test";
import { boostCheckoutAmount } from "../../supabase/functions/_shared/boostPricing.ts";

test("checkout calculates the fixed daily price independently of the browser", () => {
  assert.equal(boostCheckoutAmount(3), 150);
  assert.equal(boostCheckoutAmount(7), 350);
  assert.equal(boostCheckoutAmount(14), 700);
  assert.equal(boostCheckoutAmount(7, "50.25"), 351.75);
  assert.equal(boostCheckoutAmount(3, "1.10"), 3.3);
  assert.equal(boostCheckoutAmount(30, "27397.26"), 821917.8);
});

test("checkout rejects invalid durations and server pricing", () => {
  for (const days of [0, -1, 1, 7.5, 10, 31, 366, NaN, Infinity]) {
    assert.throws(() => boostCheckoutAmount(days), /3, 7, 14, or 30-day boost/);
  }
  for (const rate of ["0", "-50", "NaN", "Infinity", "50.001", "1e2", "27397.27"]) {
    assert.throws(() => boostCheckoutAmount(7, rate), /pricing is unavailable/);
  }
});
