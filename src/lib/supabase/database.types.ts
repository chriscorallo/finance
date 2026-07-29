/**
 * Hand-authored to match supabase/migrations exactly. Regenerate with
 * `supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
 * once a real Supabase project is linked (see PLAID_INTEGRATION.md / DEPLOYMENT.md) —
 * at that point this file becomes generated output and should not be hand-edited.
 *
 * Tables not yet read/written by any Phase 1 code use a conservative
 * `Record<string, unknown>` row shape rather than a hand-guessed column list,
 * to avoid asserting column types this codebase hasn't verified end-to-end.
 * They get replaced by the real generated shape when Phase 2+ starts using them.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "money_market",
  "credit_card",
  "loan_personal",
  "loan_student",
  "loan_mortgage",
  "loan_auto",
  "brokerage",
  "retirement",
  "crypto",
  "real_estate",
  "vehicle",
  "business_equity",
  "other_asset",
  "other_liability",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used via `typeof PHASE_2_PLUS_TABLES` below, not as a value
const PHASE_2_PLUS_TABLES = [
  "account_balances",
  "transaction_categories",
  "transaction_category_rules",
  "transactions",
  "transaction_splits",
  "transaction_tags",
  "recurring_items",
  "recurring_occurrences",
  "bills",
  "goals",
  "goal_contributions",
  "debts",
  "debt_terms",
  "debt_scenarios",
  "debt_scenario_payments",
  "calendar_events",
  "budgets",
  "budget_periods",
  "assets",
  "liabilities",
  "manual_valuations",
  "forecasts",
  "forecast_scenarios",
  "alerts",
  "alert_preferences",
  "ai_conversations",
  "ai_messages",
  "ai_data_access_logs",
  "synchronization_jobs",
  "synchronization_errors",
  "exports",
  "file_attachments",
] as const;

export interface Database {
  public: {
    Tables: {
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          privacy_mode: boolean;
          theme: "system" | "light" | "dark";
          ai_analysis_enabled: boolean;
          analytics_enabled: boolean;
          transaction_retention_days: number | null;
          safe_to_spend_mode: "conservative" | "expected" | "flexible";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          privacy_mode?: boolean;
          theme?: "system" | "light" | "dark";
          ai_analysis_enabled?: boolean;
          analytics_enabled?: boolean;
          transaction_retention_days?: number | null;
          safe_to_spend_mode?: "conservative" | "expected" | "flexible";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
        Relationships: [];
      };
      login_events: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          success: boolean;
          failure_reason: string | null;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          success: boolean;
          failure_reason?: string | null;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["login_events"]["Insert"]>;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          event_data: Json;
          ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          event_type: string;
          event_data?: Json;
          ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [];
      };
      connected_institutions: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_institution_id: string | null;
          name: string;
          logo_url: string | null;
          status: "active" | "error" | "disconnected";
          last_successful_sync_at: string | null;
          last_attempted_sync_at: string | null;
          error_code: string | null;
          error_message: string | null;
          disconnected_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider?: string;
          provider_institution_id?: string | null;
          name: string;
          logo_url?: string | null;
          status?: "active" | "error" | "disconnected";
          last_successful_sync_at?: string | null;
          last_attempted_sync_at?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          disconnected_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["connected_institutions"]["Insert"]>;
        Relationships: [];
      };
      encrypted_provider_tokens: {
        Row: {
          id: string;
          user_id: string;
          institution_id: string;
          provider: string;
          encrypted_access_token: string;
          encryption_key_version: number;
          rotated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institution_id: string;
          provider?: string;
          encrypted_access_token: string;
          encryption_key_version?: number;
          rotated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["encrypted_provider_tokens"]["Insert"]>;
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          user_id: string;
          institution_id: string | null;
          provider_account_id: string | null;
          name: string;
          official_name: string | null;
          account_type: AccountType;
          account_subtype: string | null;
          mask: string | null;
          current_balance_cents: number;
          available_balance_cents: number | null;
          currency: string;
          // numeric(6,4) — PostgREST returns numeric columns as strings to
          // avoid float precision loss; parse with Number() when needed.
          interest_rate: string | null;
          credit_limit_cents: number | null;
          minimum_payment_cents: number | null;
          payment_due_day: number | null;
          is_manual: boolean;
          include_in_net_worth: boolean;
          include_in_liquid_net_worth: boolean;
          include_in_spending: boolean;
          sync_status: "ok" | "error" | "stale" | "never_synced";
          last_synced_at: string | null;
          notes: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          institution_id?: string | null;
          provider_account_id?: string | null;
          name: string;
          official_name?: string | null;
          account_type: AccountType;
          account_subtype?: string | null;
          mask?: string | null;
          current_balance_cents?: number;
          available_balance_cents?: number | null;
          currency?: string;
          interest_rate?: string | null;
          credit_limit_cents?: number | null;
          minimum_payment_cents?: number | null;
          payment_due_day?: number | null;
          is_manual?: boolean;
          include_in_net_worth?: boolean;
          include_in_liquid_net_worth?: boolean;
          include_in_spending?: boolean;
          sync_status?: "ok" | "error" | "stale" | "never_synced";
          last_synced_at?: string | null;
          notes?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["accounts"]["Insert"]>;
        Relationships: [];
      };
    } & { [K in (typeof PHASE_2_PLUS_TABLES)[number]]: GenericTable };
    Views: Record<string, never>;
    Functions: {
      list_active_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          id: string;
          created_at: string;
          updated_at: string;
          refreshed_at: string | null;
          not_after: string | null;
          aal: string | null;
          user_agent: string | null;
          ip: string | null;
          is_current: boolean;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
