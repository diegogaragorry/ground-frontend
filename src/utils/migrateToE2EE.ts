/**
 * E2EE migration: encrypt all plain (non-encrypted) data with the current key.
 * For each entity we fetch items; if an item has no encryptedPayload we build payload from plain fields,
 * encrypt, and PUT/PATCH with encryptedPayload and zeros.
 *
 * IMPORTANTE – Snapshots: el API GET /investments/:id/snapshots?year= devuelve 12 elementos (uno por mes).
 * Los meses sin fila en DB vienen como placeholder con id: null, closingCapital/closingCapitalUsd null.
 * Solo debemos hacer PUT en meses que YA tienen fila (s.id != null). Si no, cifraríamos 0 y el PUT haría
 * upsert creando filas nuevas en 0 para todos los meses → rompe proyección y llena la DB de registros fantasma.
 */

type Api = <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
type EncryptPayload = <T>(payload: T) => Promise<string | null>;

const currentYear = new Date().getFullYear();
const YEARS_TO_MIGRATE = [currentYear - 1, currentYear];

export type MigrationStatus = {
  income: number;
  expenses: number;
  investmentSnapshots: number;
  investmentMovements: number;
  budgets: number;
  templates: number;
  planned: number;
  otherExpenses: number;
  monthCloses: number;
  total: number;
};

export type MigrationResult = {
  ok: boolean;
  errorCount: number;
  errors: string[];
  migrated: { income: number; expenses: number; investmentSnapshots: number; investmentMovements: number; budgets: number; templates: number; planned: number; otherExpenses: number; monthCloses: number };
};

export type MigrationProgress = (phase: string) => void;

/** Returns counts of items that still have plain data (no encryptedPayload or non-zero amount). */
export async function getMigrationStatus(api: Api): Promise<MigrationStatus> {
  const status: MigrationStatus = {
    income: 0,
    expenses: 0,
    investmentSnapshots: 0,
    investmentMovements: 0,
    budgets: 0,
    templates: 0,
    planned: 0,
    otherExpenses: 0,
    monthCloses: 0,
    total: 0,
  };

  for (const year of YEARS_TO_MIGRATE) {
    const incomeResp = await api<{ rows: Array<{ month: number; encryptedPayload?: string | null }> }>(`/income?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of incomeResp?.rows ?? []) {
      if (!row.encryptedPayload) status.income++;
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const list = await api<Array<{ id: string; encryptedPayload?: string | null; amountUsd?: number }>>(`/expenses?year=${year}&month=${month}`).catch(() => []);
      for (const e of list ?? []) {
        if (!e.encryptedPayload || (e.amountUsd != null && e.amountUsd !== 0)) status.expenses++;
      }
    }
  }

  const invs = await api<Array<{ id: string }>>("/investments").catch(() => []);
  for (const inv of invs ?? []) {
    for (const year of YEARS_TO_MIGRATE) {
      const r = await api<{ months: Array<{ id: string | null; year: number; month: number; encryptedPayload?: string | null }> }>(`/investments/${inv.id}/snapshots?year=${year}`).catch(() => ({ months: [] }));
      for (const s of r?.months ?? []) {
        if (s.id != null && !s.encryptedPayload) status.investmentSnapshots++;
      }
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    const movResp = await api<{ rows: Array<{ encryptedPayload?: string | null }> }>(`/investments/movements?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of movResp?.rows ?? []) {
      if (!row.encryptedPayload) status.investmentMovements++;
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const budgetList = await api<Array<{ encryptedPayload?: string | null }>>(`/budgets?year=${year}&month=${month}`).catch(() => []);
      for (const b of budgetList ?? []) {
        if (!b.encryptedPayload) status.budgets++;
      }
    }
  }

  const templatesResp = await api<{ rows: Array<{ encryptedPayload?: string | null }> }>("/admin/expenseTemplates").catch(() => ({ rows: [] }));
  for (const row of templatesResp?.rows ?? []) {
    if (!row.encryptedPayload) status.templates++;
  }

  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const plannedResp = await api<{ rows: Array<{ encryptedPayload?: string | null }> }>(`/plannedExpenses?year=${year}&month=${month}`).catch(() => ({ rows: [] }));
      for (const p of plannedResp?.rows ?? []) {
        if (!p.encryptedPayload) status.planned++;
      }
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    const annualResp = await api<{ months: Array<{ month: number; otherExpensesUsd?: number; otherExpensesEncryptedPayload?: string }> }>(`/budgets/annual?year=${year}`).catch(() => ({ months: [] }));
    for (const m of annualResp?.months ?? []) {
      if (!m.otherExpensesEncryptedPayload) status.otherExpenses++;
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    const closesResp = await api<{ rows: Array<{ encryptedPayload?: string | null }> }>(`/monthCloses?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of closesResp?.rows ?? []) {
      if (!row.encryptedPayload) status.monthCloses++;
    }
  }

  status.total =
    status.income +
    status.expenses +
    status.investmentSnapshots +
    status.investmentMovements +
    status.budgets +
    status.templates +
    status.planned +
    status.otherExpenses +
    status.monthCloses;
  return status;
}

export async function runMigration(
  api: Api,
  encryptPayload: EncryptPayload,
  onProgress?: MigrationProgress
): Promise<MigrationResult> {
  const progress = onProgress ?? (() => {});
  const errors: string[] = [];
  const migrated = {
    income: 0,
    expenses: 0,
    investmentSnapshots: 0,
    investmentMovements: 0,
    budgets: 0,
    templates: 0,
    planned: 0,
    otherExpenses: 0,
    monthCloses: 0,
  };

  progress("income");
  for (const year of YEARS_TO_MIGRATE) {
    const incomeResp = await api<{ rows: Array<{ id?: string; month: number; nominalUsd?: number; extraordinaryUsd?: number; taxesUsd?: number; totalUsd?: number; encryptedPayload?: string | null }> }>(`/income?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of incomeResp?.rows ?? []) {
      if (row.encryptedPayload) continue;
      const nominal = row.nominalUsd ?? row.totalUsd ?? 0;
      const extraordinary = row.extraordinaryUsd ?? 0;
      const taxes = row.taxesUsd ?? 0;
      const enc = await encryptPayload({ nominalUsd: nominal, extraordinaryUsd: extraordinary, taxesUsd: taxes });
      if (!enc) continue;
      try {
        await api("/income", {
          method: "PATCH",
          body: JSON.stringify({ year, month: row.month, encryptedPayload: enc, nominalUsd: 0, extraordinaryUsd: 0, taxesUsd: 0 }),
        });
        migrated.income++;
      } catch (e: unknown) {
        errors.push(`Income ${year}-${row.month}: ${e instanceof Error ? e.message : "Error"}`);
      }
    }
  }

  progress("expenses");
  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const list = await api<Array<{ id: string; description?: string; amount?: number; amountUsd?: number; usdUyuRate?: number | null; currencyId?: string; encryptedPayload?: string | null }>>(`/expenses?year=${year}&month=${month}`).catch(() => []);
      for (const e of list ?? []) {
        if (e.encryptedPayload && (e.amountUsd == null || e.amountUsd === 0)) continue;
        const desc = e.description ?? "";
        const amt = e.amount ?? 0;
        const amtUsd = e.amountUsd ?? (e.usdUyuRate && e.usdUyuRate > 0 && e.currencyId === "UYU" ? amt / e.usdUyuRate : amt);
        const enc = await encryptPayload({ description: desc, amount: amt, amountUsd: amtUsd });
        if (!enc) continue;
        try {
          await api(`/expenses/${e.id}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: enc, amount: 0, description: "(encrypted)" }),
          });
          migrated.expenses++;
        } catch (err: unknown) {
          errors.push(`Expense ${e.id}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }
  }

  progress("investments");
  const invs = await api<Array<{ id: string; currencyId?: string }>>("/investments").catch(() => []);
  for (const inv of invs ?? []) {
    for (const year of YEARS_TO_MIGRATE) {
      const r = await api<{ months: Array<{ id: string | null; year: number; month: number; closingCapital?: number | null; closingCapitalUsd?: number | null; encryptedPayload?: string | null }> }>(`/investments/${inv.id}/snapshots?year=${year}`).catch(() => ({ months: [] }));
      for (const s of r?.months ?? []) {
        // Solo migrar filas que ya existen en DB (id != null). Nunca hacer PUT en meses placeholder (id null) para no crear registros en 0.
        if (s.id == null || s.encryptedPayload) continue;
        const capital = s.closingCapital ?? 0;
        const capitalUsd = s.closingCapitalUsd ?? capital;
        const enc = await encryptPayload({ closingCapital: capital, closingCapitalUsd: capitalUsd });
        if (!enc) continue;
        try {
          await api(`/investments/${inv.id}/snapshots/${s.year}/${s.month}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: enc, closingCapital: 0 }),
          });
          migrated.investmentSnapshots++;
        } catch (err: unknown) {
          errors.push(`Snapshot ${inv.id} ${s.year}-${s.month}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }
  }

  for (const year of YEARS_TO_MIGRATE) {
    const movResp = await api<{
      rows: Array<{
        id: string;
        investmentId: string;
        date: string;
        type: string;
        currencyId: string;
        amount?: number;
        encryptedPayload?: string | null;
      }>;
    }>(`/investments/movements?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of movResp?.rows ?? []) {
      if (row.encryptedPayload) continue;
      const amount = row.amount ?? 0;
      const enc = await encryptPayload({ amount });
      if (!enc) continue;
      try {
        await api(`/investments/movements/${row.id}`, {
          method: "PUT",
          body: JSON.stringify({
            investmentId: row.investmentId,
            date: row.date,
            type: row.type,
            currencyId: row.currencyId,
            amount: 0,
            encryptedPayload: enc,
          }),
        });
        migrated.investmentMovements++;
      } catch (err: unknown) {
        errors.push(`Movement ${row.id}: ${err instanceof Error ? err.message : "Error"}`);
      }
    }
  }

  progress("budgets");
  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const budgetList = await api<Array<{ id: string; year: number; month: number; categoryId: string; currencyId: string; amount?: number; encryptedPayload?: string | null }>>(`/budgets?year=${year}&month=${month}`).catch(() => []);
      for (const b of budgetList ?? []) {
        if (b.encryptedPayload) continue;
        const amount = b.amount ?? 0;
        const enc = await encryptPayload({ amount });
        if (!enc) continue;
        try {
          await api("/budgets", {
            method: "PUT",
            body: JSON.stringify({
              year: b.year,
              month: b.month,
              categoryId: b.categoryId,
              currencyId: b.currencyId,
              amount: 0,
              encryptedPayload: enc,
            }),
          });
          migrated.budgets++;
        } catch (err: unknown) {
          errors.push(`Budget ${b.id}: ${err instanceof Error ? err.message : "Error"}`);
        }
      }
    }
  }

  progress("templates");
  const templatesResp = await api<{ rows: Array<{ id: string; description?: string; defaultAmountUsd?: number | null; encryptedPayload?: string | null }> }>("/admin/expenseTemplates").catch(() => ({ rows: [] }));
  for (const row of templatesResp?.rows ?? []) {
    if (row.encryptedPayload) continue;
    const desc = row.description ?? "";
    const defaultAmountUsd = row.defaultAmountUsd ?? null;
    const enc = await encryptPayload({ description: desc, defaultAmountUsd: defaultAmountUsd });
    if (!enc) continue;
    try {
      await api(`/admin/expenseTemplates/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ encryptedPayload: enc }),
      });
      migrated.templates++;
    } catch (e: unknown) {
      errors.push(`Template ${row.id}: ${e instanceof Error ? e.message : "Error"}`);
    }
  }

  progress("planned");
  for (const year of YEARS_TO_MIGRATE) {
    for (let month = 1; month <= 12; month++) {
      const plannedResp = await api<{ rows: Array<{ id: string; description?: string; amountUsd?: number | null; amount?: number | null; encryptedPayload?: string | null }> }>(`/plannedExpenses?year=${year}&month=${month}`).catch(() => ({ rows: [] }));
      for (const p of plannedResp?.rows ?? []) {
        if (p.encryptedPayload) continue;
        const desc = p.description ?? "";
        const amountUsd = p.amountUsd ?? 0;
        const amount = p.amount ?? amountUsd;
        const enc = await encryptPayload({ description: desc, amountUsd, amount });
        if (!enc) continue;
        try {
          await api(`/plannedExpenses/${p.id}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: enc }),
          });
          migrated.planned++;
        } catch (e: unknown) {
          errors.push(`Planned ${p.id}: ${e instanceof Error ? e.message : "Error"}`);
        }
      }
    }
  }

  progress("other");
  for (const year of YEARS_TO_MIGRATE) {
    const annualResp = await api<{ months: Array<{ month: number; otherExpensesUsd?: number; otherExpensesEncryptedPayload?: string }> }>(`/budgets/annual?year=${year}`).catch(() => ({ months: [] }));
    for (const m of annualResp?.months ?? []) {
      if (m.otherExpensesEncryptedPayload) continue;
      const otherUsd = m.otherExpensesUsd ?? 0;
      const enc = await encryptPayload({ otherExpensesUsd: otherUsd });
      if (!enc) continue;
      try {
        await api(`/budgets/other-expenses/${year}/${m.month}`, {
          method: "PUT",
          body: JSON.stringify({ encryptedPayload: enc }),
        });
        migrated.otherExpenses++;
      } catch (e: unknown) {
        errors.push(`Other ${year}-${m.month}: ${e instanceof Error ? e.message : "Error"}`);
      }
    }
  }

  progress("monthCloses");
  for (const year of YEARS_TO_MIGRATE) {
    const closesResp = await api<{ rows: Array<{ id: string; incomeUsd?: number; expensesUsd?: number; investmentEarningsUsd?: number; balanceUsd?: number; netWorthStartUsd?: number | null; netWorthEndUsd?: number | null; encryptedPayload?: string | null }> }>(`/monthCloses?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of closesResp?.rows ?? []) {
      if (row.encryptedPayload) continue;
      const snapshot = {
        incomeUsd: row.incomeUsd ?? 0,
        expensesUsd: row.expensesUsd ?? 0,
        investmentEarningsUsd: row.investmentEarningsUsd ?? 0,
        balanceUsd: row.balanceUsd ?? 0,
        netWorthStartUsd: row.netWorthStartUsd ?? 0,
        netWorthEndUsd: row.netWorthEndUsd ?? undefined,
      };
      const enc = await encryptPayload(snapshot);
      if (!enc) continue;
      try {
        await api(`/monthCloses/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ encryptedPayload: enc }),
        });
        migrated.monthCloses++;
      } catch (e: unknown) {
        errors.push(`MonthClose ${row.id}: ${e instanceof Error ? e.message : "Error"}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    errors: errors.slice(0, 15),
    migrated,
  };
}
