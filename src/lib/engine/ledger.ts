// Pure credit-ledger math. This mirrors the SQL functions in supabase/migrations/0001_init.sql
// exactly, so the reserve -> settle -> refund flow can be proven with unit tests and with an
// in-memory simulation BEFORE any real provider spend.
//
// Flow (Section 3.2 / non-negotiable rule 3):
//   RESERVE at submit  -> debit estimated credits, gated on balance.
//   SETTLE the delta   -> debit (actual - estimated); negative means credit part of it back.
//   REFUND on failure  -> credit the full reserved amount back (nothing was spent).

export type TxnKind = "grant" | "reserve" | "settle" | "refund";

export class InsufficientCreditsError extends Error {
  constructor(balance: number, debit: number) {
    super(`insufficient_credits: balance ${balance} cannot cover debit ${debit}`);
    this.name = "InsufficientCreditsError";
  }
}

/** Can this balance cover reserving `estimated` credits? */
export function canReserve(balance: number, estimated: number): boolean {
  return balance - estimated >= 0;
}

/**
 * The signed settle delta to debit at completion.
 * Positive = charge the user more (actual > estimated).
 * Negative = refund part of the reservation (actual < estimated).
 * Net charge across reserve+settle always equals `actual`.
 */
export function settleDelta(estimated: number, actual: number): number {
  return actual - estimated;
}

/** Apply a debit of `amount` (positive = subtract) to a balance, optionally gating at zero. */
export function applyDebit(balance: number, amount: number, gate: boolean): number {
  const next = balance - amount;
  if (gate && next < 0) {
    throw new InsufficientCreditsError(balance, amount);
  }
  return next;
}

// ---------------------------------------------------------------------------
// In-memory ledger simulation. Used by tests to verify end-to-end correctness
// of the reserve/settle/refund lifecycle without a database. The real lifecycle
// runs through the SECURITY DEFINER Postgres functions via credits.ts.
// ---------------------------------------------------------------------------

export interface SimTxn {
  kind: TxnKind;
  amount: number; // signed change to balance
  balanceAfter: number;
  jobId?: string;
}

export class LedgerSim {
  balance = 0;
  txns: SimTxn[] = [];
  // Mirrors the (job_id, kind) idempotency in migration 0003: each reserve/settle/refund applies
  // at most once per job.
  private applied = new Set<string>();

  grant(amount: number): number {
    if (amount <= 0) throw new Error("grant amount must be positive");
    this.balance += amount;
    this.txns.push({ kind: "grant", amount, balanceAfter: this.balance });
    return this.balance;
  }

  /** Debit a magnitude (positive subtracts; negative credits back). Mirrors debit_credits. */
  private debit(amount: number, kind: TxnKind, gate: boolean, jobId?: string): number {
    // Idempotency: a repeat (job, kind) is a no-op returning the current balance.
    if (jobId) {
      const key = `${jobId}:${kind}`;
      if (this.applied.has(key)) return this.balance;
      this.applied.add(key);
    }
    const delta = -amount;
    if (gate && this.balance + delta < 0) {
      throw new InsufficientCreditsError(this.balance, amount);
    }
    this.balance += delta;
    this.txns.push({ kind, amount: delta, balanceAfter: this.balance, jobId });
    return this.balance;
  }

  reserve(estimated: number, jobId?: string): number {
    return this.debit(estimated, "reserve", true, jobId);
  }

  settle(estimated: number, actual: number, jobId?: string): number {
    return this.debit(settleDelta(estimated, actual), "settle", false, jobId);
  }

  refund(reserved: number, jobId?: string): number {
    // Negative debit = credit the full reservation back.
    return this.debit(-reserved, "refund", false, jobId);
  }
}
