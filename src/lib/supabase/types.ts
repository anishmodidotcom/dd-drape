// Hand-written Database types for the Drape v1 schema (drape_ namespaced, shared CGE project).
// Replace with generated types later via:
//   supabase gen types typescript --project-id <id> --schema public > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      drape_credit_balances: {
        Row: { user_id: string; balance: number; updated_at: string };
        Insert: { user_id: string; balance?: number; updated_at?: string };
        Update: { user_id?: string; balance?: number; updated_at?: string };
        Relationships: [];
      };
      drape_credit_transactions: {
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
        Update: Partial<Database["public"]["Tables"]["drape_credit_transactions"]["Insert"]>;
        Relationships: [];
      };
      drape_products: {
        Row: {
          id: string;
          user_id: string;
          image_path: string;
          analysis: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          image_path: string;
          analysis?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drape_products"]["Insert"]>;
        Relationships: [];
      };
      drape_models: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          inputs: Json;
          image_paths: string[];
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          inputs?: Json;
          image_paths?: string[];
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drape_models"]["Insert"]>;
        Relationships: [];
      };
      drape_jobs: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          user_email: string | null;
          type: string;
          provider: string;
          payload: Json;
          status: string;
          tier: string | null;
          qc_status: string;
          estimated_credits: number;
          actual_credits: number | null;
          attempts: number;
          last_error: string | null;
          result_ref: string | null;
          thumb_ref: string | null;
          parent_job_id: string | null;
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
          tier?: string | null;
          qc_status?: string;
          estimated_credits?: number;
          actual_credits?: number | null;
          attempts?: number;
          last_error?: string | null;
          result_ref?: string | null;
          thumb_ref?: string | null;
          parent_job_id?: string | null;
          fal_request_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drape_jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      drape_grant_credits: {
        Args: { p_user_id: string; p_amount: number; p_note?: string | null };
        Returns: number;
      };
      drape_debit_credits: {
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
      drape_claim_next_job: {
        Args: { p_types: string[] };
        Returns: Database["public"]["Tables"]["drape_jobs"]["Row"];
      };
      drape_list_stale_jobs: {
        Args: { p_minutes: number };
        Returns: Database["public"]["Tables"]["drape_jobs"]["Row"][];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
