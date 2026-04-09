import { describe, expect, it } from "vitest";
import { suggestTemplateForRowWithRules } from "./suggestions";
import type { LearnedMerchantRule, ParsedImportRow, TemplateCandidate } from "./types";

const baseRow: ParsedImportRow = {
  id: "row-1",
  date: "2026-04-01",
  merchantRaw: "DISCO POCITOS",
  merchantNormalized: "disco pocitos",
  descriptionSuggested: "DISCO POCITOS",
  amount: 1200,
  currencyId: "UYU",
  sourceType: "purchase",
  status: "accepted",
  shouldIgnore: false,
  ignoreReason: null,
  cardLast4: null,
  metadata: {},
  suggestion: null,
};

describe("import suggestions", () => {
  it("prioritizes learned merchant rules over template keyword matches", () => {
    const templates: TemplateCandidate[] = [
      {
        id: "tpl-1",
        description: "Restaurants",
        categoryId: "cat-rest",
        categoryName: "Dining & Leisure",
        expenseType: "VARIABLE",
      },
    ];

    const rules: LearnedMerchantRule[] = [
      {
        id: "rule-1",
        merchantFingerprint: "fp-1",
        merchantNormalized: "disco pocitos",
        descriptionSuggested: "Supermercado Disco",
        categoryId: "cat-grocery",
        categoryName: "Food & Grocery",
        expenseType: "VARIABLE",
        useCount: 3,
        lastLearnedAt: null,
      },
    ];

    const suggestion = suggestTemplateForRowWithRules(baseRow, templates, rules);
    expect(suggestion?.categoryId).toBe("cat-grocery");
    expect(suggestion?.descriptionSuggested).toBe("Supermercado Disco");
    expect(suggestion?.reason).toBe("learned-rule-exact-match");
  });
});
