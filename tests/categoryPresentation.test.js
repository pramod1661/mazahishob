import assert from "node:assert/strict";
import test from "node:test";

import {
  getExpenseCategoryIconType,
  getExpenseCategoryKey,
} from "../src/domain/categoryPresentation.js";

test("the same expense category always resolves to the same icon", () => {
  assert.equal(getExpenseCategoryIconType("Food"), "food");
  assert.equal(getExpenseCategoryIconType(" food "), "food");
  assert.equal(getExpenseCategoryIconType("FOOD"), "food");
});

test("each expense category has a stable semantic icon", () => {
  assert.deepEqual(
    ["Food", "Grocery", "Bills", "Travel", "Shopping", "Medical", "Other"].map(
      getExpenseCategoryIconType
    ),
    ["food", "cart", "bolt", "travel", "shopping", "medical", "other"]
  );
  assert.equal(getExpenseCategoryKey("Unknown category"), "other");
});
