/**
 * E2EE key rotation: after password change, re-encrypt all blobs with the new key.
 * Uses current (old) key from context to decrypt, then encrypts with new key and PUTs each record.
 */

import { deriveEncryptionKey, encryptWithKey } from "./crypto";

type Api = <T = any>(path: string, options?: RequestInit) => Promise<T>;
type DecryptPayload = (ciphertextBase64: string) => Promise<unknown | null>;

const currentYear = new Date().getFullYear();
const YEARS_TO_ROTATE = [currentYear - 1, currentYear];

export type KeyRotationResult = {
  ok: boolean;
  errorCount: number;
  errors: string[];
};

export type KeyRotationProgress = (phase: string) => void;

export async function runKeyRotation(
  api: Api,
  decryptPayload: DecryptPayload,
  setEncryptionKey: (key: string | null) => void,
  newPassword: string,
  encryptionSalt: string,
  onProgress?: KeyRotationProgress
): Promise<KeyRotationResult> {
  const progress = onProgress ?? (() => {});

  const newKey = await deriveEncryptionKey(newPassword, encryptionSalt);

  async function reEncrypt(ciphertext: string): Promise<string | null> {
    const pl = await decryptPayload(ciphertext);
    if (pl == null) return null;
    return encryptWithKey(JSON.stringify(pl), newKey);
  }

  const errors: string[] = [];

  progress("income");
  for (const year of YEARS_TO_ROTATE) {
    const incomeResp = await api<{ rows: Array<{ id?: string; month: number; encryptedPayload?: string | null }> }>(`/income?year=${year}`);
    for (const row of incomeResp?.rows ?? []) {
      if (!row.encryptedPayload || !row.id) continue;
      const blob = await reEncrypt(row.encryptedPayload);
      if (blob)
        await api("/income", {
          method: "PATCH",
          body: JSON.stringify({ year, month: row.month, encryptedPayload: blob, nominalUsd: 0, extraordinaryUsd: 0, taxesUsd: 0 }),
        }).catch((e: any) => errors.push(`Income ${year}-${row.month}: ${e?.message ?? "Error"}`));
    }
  }

  progress("expenses");
  for (const year of YEARS_TO_ROTATE) {
    for (let month = 1; month <= 12; month++) {
      const list = await api<any[]>(`/expenses?year=${year}&month=${month}`).catch(() => []);
      for (const e of list ?? []) {
        if (!e.encryptedPayload || !e.id) continue;
        const blob = await reEncrypt(e.encryptedPayload);
        if (blob)
          await api(`/expenses/${e.id}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: blob, amount: 0, description: "(encrypted)" }),
          }).catch((err: any) => errors.push(`Expense ${e.id}: ${err?.message ?? "Error"}`));
      }
    }
  }

  progress("investments");
  const invs = await api<Array<{ id: string }>>("/investments").catch(() => []);
  for (const inv of invs ?? []) {
    const r = await api<{ months: Array<{ id: string | null; year: number; month: number; encryptedPayload?: string | null }> }>(`/investments/${inv.id}/snapshots?year=${currentYear}`).catch(() => ({ months: [] }));
    for (const s of r?.months ?? []) {
      // Solo re-encriptar filas existentes (id != null y con payload). No hacer PUT en placeholders para no crear registros en 0.
      if (s.id == null || !s.encryptedPayload) continue;
      const blob = await reEncrypt(s.encryptedPayload);
      if (blob)
        await api(`/investments/${inv.id}/snapshots/${s.year}/${s.month}`, {
          method: "PUT",
          body: JSON.stringify({ encryptedPayload: blob, closingCapital: 0 }),
        }).catch((err: any) => errors.push(`Snapshot ${inv.id}: ${err?.message ?? "Error"}`));
    }
  }

  const movResp = await api<{
    rows: Array<{
      id: string;
      investmentId: string;
      date: string;
      type: string;
      currencyId: string;
      encryptedPayload?: string | null;
    }>;
  }>(`/investments/movements?year=${currentYear}`).catch(() => ({ rows: [] }));
  for (const row of movResp?.rows ?? []) {
    if (!row.encryptedPayload) continue;
    const blob = await reEncrypt(row.encryptedPayload);
    if (blob)
      await api(`/investments/movements/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          investmentId: row.investmentId,
          date: row.date,
          type: row.type,
          currencyId: row.currencyId,
          amount: 0,
          encryptedPayload: blob,
        }),
      }).catch((err: any) => errors.push(`Movement ${row.id}: ${err?.message ?? "Error"}`));
  }

  progress("budgets");
  for (const year of YEARS_TO_ROTATE) {
    for (let month = 1; month <= 12; month++) {
      const budgetList = await api<Array<{ id: string; year: number; month: number; categoryId: string; currencyId: string; encryptedPayload?: string | null }>>(`/budgets?year=${year}&month=${month}`).catch(() => []);
      for (const b of budgetList ?? []) {
        if (!b.encryptedPayload) continue;
        const blob = await reEncrypt(b.encryptedPayload);
        if (blob)
          await api("/budgets", {
            method: "PUT",
            body: JSON.stringify({
              year: b.year,
              month: b.month,
              categoryId: b.categoryId,
              currencyId: b.currencyId,
              amount: 0,
              encryptedPayload: blob,
            }),
          }).catch((err: any) => errors.push(`Budget ${b.id}: ${err?.message ?? "Error"}`));
      }
    }
  }

  progress("templates");
  // ExpenseTemplate
  const templatesResp = await api<{ rows: Array<{ id: string; encryptedPayload?: string | null }> }>("/admin/expenseTemplates").catch(() => ({ rows: [] }));
  for (const row of templatesResp?.rows ?? []) {
    if (!row.encryptedPayload) continue;
    const blob = await reEncrypt(row.encryptedPayload);
    if (blob)
      await api(`/admin/expenseTemplates/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({ encryptedPayload: blob }),
      }).catch((e: any) => errors.push(`Template ${row.id}: ${e?.message ?? "Error"}`));
  }

  progress("planned");
  // PlannedExpense (by year/month)
  for (const year of YEARS_TO_ROTATE) {
    for (let month = 1; month <= 12; month++) {
      const plannedResp = await api<{ rows: Array<{ id: string; encryptedPayload?: string | null }> }>(`/plannedExpenses?year=${year}&month=${month}`).catch(() => ({ rows: [] }));
      for (const p of plannedResp?.rows ?? []) {
        if (!p.encryptedPayload) continue;
        const blob = await reEncrypt(p.encryptedPayload);
        if (blob)
          await api(`/plannedExpenses/${p.id}`, {
            method: "PUT",
            body: JSON.stringify({ encryptedPayload: blob }),
          }).catch((e: any) => errors.push(`Planned ${p.id}: ${e?.message ?? "Error"}`));
      }
    }
  }

  progress("other");
  // MonthlyBudget "other expenses" (from annual response)
  for (const year of YEARS_TO_ROTATE) {
    const annualResp = await api<{
      year: number;
      months: Array<{ month: number; otherExpensesEncryptedPayload?: string }>;
    }>(`/budgets/annual?year=${year}`).catch(() => ({ months: [] }));
    for (const m of annualResp?.months ?? []) {
      if (!m.otherExpensesEncryptedPayload) continue;
      const blob = await reEncrypt(m.otherExpensesEncryptedPayload);
      if (blob)
        await api(`/budgets/other-expenses/${year}/${m.month}`, {
          method: "PUT",
          body: JSON.stringify({ encryptedPayload: blob }),
        }).catch((e: any) => errors.push(`Other ${year}-${m.month}: ${e?.message ?? "Error"}`));
    }
  }

  progress("monthCloses");
  // MonthClose
  for (const year of YEARS_TO_ROTATE) {
    const closesResp = await api<{ rows: Array<{ id: string; encryptedPayload?: string | null }> }>(`/monthCloses?year=${year}`).catch(() => ({ rows: [] }));
    for (const row of closesResp?.rows ?? []) {
      if (!row.encryptedPayload) continue;
      const blob = await reEncrypt(row.encryptedPayload);
      if (blob)
        await api(`/monthCloses/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({ encryptedPayload: blob }),
        }).catch((e: any) => errors.push(`MonthClose ${row.id}: ${e?.message ?? "Error"}`));
    }
  }

  setEncryptionKey(newKey);
  return {
    ok: errors.length === 0,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
  };
}
