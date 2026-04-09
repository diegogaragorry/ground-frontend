import type { ImportSuggestion, LearnedMerchantRule, ParsedImportRow, TemplateCandidate } from "./types";
import { normalizeImportText } from "./parsers";

const keywordGroups: Array<{ label: string; merchantKeywords: string[]; templateKeywords: string[] }> = [
  {
    label: "supermercado",
    merchantKeywords: ["disco", "tata", "dorado", "mercado", "supermercado", "market"],
    templateKeywords: ["supermercado", "almacen", "comida", "groceries"],
  },
  {
    label: "restaurantes",
    merchantKeywords: ["pedidosya", "mcdonalds", "arcos dorados", "cafe", "cantina", "molienda", "tapeo", "magnolia"],
    templateKeywords: ["restaurante", "restaurantes", "salidas", "delivery", "comida afuera"],
  },
  {
    label: "farmacia",
    merchantKeywords: ["farmashop", "farmacia"],
    templateKeywords: ["farmacia", "salud"],
  },
  {
    label: "salud",
    merchantKeywords: ["medicina", "semm", "clinica", "hospital"],
    templateKeywords: ["salud", "seguro medico", "medico", "medicina"],
  },
  {
    label: "combustible",
    merchantKeywords: ["ancap", "shell", "estacion", "combustible"],
    templateKeywords: ["combustible", "nafta", "auto"],
  },
  {
    label: "suscripciones",
    merchantKeywords: ["spotify", "disney", "openai", "twilio", "railway", "apple"],
    templateKeywords: ["suscripcion", "suscripciones", "software", "streaming"],
  },
  {
    label: "transporte",
    merchantKeywords: ["copsa", "stm", "vial"],
    templateKeywords: ["transporte", "peajes", "movilidad"],
  },
];

function tokenize(value: string) {
  return normalizeImportText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

export function suggestTemplateForRow(row: ParsedImportRow, templates: TemplateCandidate[]): ImportSuggestion | null {
  const merchantNormalized = normalizeImportText(row.merchantRaw);
  const merchantTokens = new Set(tokenize(row.merchantRaw));
  if (!merchantNormalized || merchantTokens.size === 0) return null;
  return suggestTemplateForRowWithRules(row, templates, []);
}

export function suggestTemplateForRowWithRules(
  row: ParsedImportRow,
  templates: TemplateCandidate[],
  learnedRules: LearnedMerchantRule[]
): ImportSuggestion | null {
  const merchantNormalized = normalizeImportText(row.merchantRaw);
  const merchantTokens = new Set(tokenize(row.merchantRaw));
  if (!merchantNormalized || merchantTokens.size === 0) return null;

  let bestRule: ImportSuggestion | null = null;
  for (const rule of learnedRules) {
    if (!rule.merchantNormalized) continue;

    let score = 0;
    if (rule.merchantNormalized === merchantNormalized) {
      score = 100 + rule.useCount;
    } else if (
      rule.merchantNormalized.length >= 6 &&
      (merchantNormalized.includes(rule.merchantNormalized) || rule.merchantNormalized.includes(merchantNormalized))
    ) {
      score = 70 + Math.min(rule.useCount, 10);
    } else {
      const ruleTokens = tokenize(rule.merchantNormalized);
      const shared = ruleTokens.filter((token) => merchantTokens.has(token));
      if (shared.length > 0) score = 40 + shared.length * 4 + Math.min(rule.useCount, 10);
    }

    if (score <= 0) continue;

    const suggestion: ImportSuggestion = {
      templateId: null,
      categoryId: rule.categoryId,
      categoryName: rule.categoryName,
      expenseType: rule.expenseType,
      descriptionSuggested: rule.descriptionSuggested,
      score,
      reason: score >= 100 ? "learned-rule-exact-match" : "learned-rule-match",
    };

    if (!bestRule || suggestion.score > bestRule.score) bestRule = suggestion;
  }

  if (bestRule) return bestRule;

  let best: ImportSuggestion | null = null;

  for (const template of templates) {
    const candidateText = `${template.description} ${template.categoryName}`;
    const candidateNormalized = normalizeImportText(candidateText);
    const candidateTokens = tokenize(candidateText);

    let score = 0;
    const shared = candidateTokens.filter((token) => merchantTokens.has(token));
    score += shared.length * 1.2;

    if (merchantNormalized.includes(normalizeImportText(template.description))) score += 2;
    if (candidateNormalized.includes(merchantNormalized)) score += 1.5;

    for (const group of keywordGroups) {
      const merchantHit = group.merchantKeywords.some((token) => merchantNormalized.includes(token));
      const templateHit = group.templateKeywords.some((token) => candidateNormalized.includes(token));
      if (merchantHit && templateHit) score += 2.4;
    }

    if (score <= 0) continue;

    const suggestion: ImportSuggestion = {
      templateId: template.id,
      categoryId: template.categoryId,
      categoryName: template.categoryName,
      expenseType: template.expenseType,
      descriptionSuggested: template.description,
      score,
      reason: shared.length > 0 ? "template-token-match" : "template-keyword-match",
    };

    if (!best || suggestion.score > best.score) best = suggestion;
  }

  return best && best.score >= 2 ? best : null;
}
