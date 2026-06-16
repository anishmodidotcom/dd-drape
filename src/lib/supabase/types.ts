// Hand-written Database types for the Phase 0 schema. Replace with generated types later via:
//   supabase gen types typescript --project-id <id> > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      credit_balances: {
        Row: { user_id: string; balance: number; updated_at: string };
        Insert: { user_id: string; balance?: number; updated_at?: string };
        Update: { user_id?: string; balance?: number; updated_at?: string };
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          job_id: string | null;
          kind: string;
          amount: number;
          balance_after: number;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          job_id?: string | null;
          kind: string;
          amount: number;
          balance_after: number;
          note?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credit_transactions"]["Insert"]>;
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          user_email: string | null;
          type: string;
          provider: string;
          payload: Json;
          status: string;
          estimated_credits: number;
          actual_credits: number | null;
          attempts: number;
          last_error: string | null;
          result_ref: string | null;
          fal_request_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          user_email?: string | null;
          type: string;
          provider?: string;
          payload?: Json;
          status?: string;
          estimated_credits?: number;
          actual_credits?: number | null;
          attempts?: number;
          last_error?: string | null;
          result_ref?: string | null;
          fal_request_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      grant_credits: {
        Args: { p_user_id: string; p_amount: number; p_note?: string | null };
        Returns: number;
      };
      debit_credits: {
        Args: {
          p_user_id: string;
          p_amount: number;
          p_job_id: string | null;
          p_kind: string;
          p_gate?: boolean;
          p_note?: string | null;
        };
        Returns: number;
      };
      claim_next_job: {
        Args: { p_types: string[] };
        Returns: Database["public"]["Tables"]["jobs"]["Row"];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
