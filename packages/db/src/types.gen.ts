/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate after every migration:
 *   pnpm db:types      (supabase gen types typescript --local)
 *
 * This copy was hand-written to match `supabase/migrations/20260731000001_init.sql`
 * exactly so the template typechecks before you have a database running. The
 * first `pnpm db:types` overwrites it with the real thing.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          user_id: string;
          company: string;
          email: string;
          items: Json;
          note: string | null;
          status: Database["public"]["Enums"]["order_status"];
          total_cents: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          company: string;
          email: string;
          items: Json;
          note?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          company?: string;
          email?: string;
          items?: Json;
          note?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          total_cents?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_run: {
        Row: {
          id: string;
          task_id: string;
          run_id: string | null;
          started_at: string;
          finished_at: string | null;
          outcome: string;
          counts: Json;
          error: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          run_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          outcome?: string;
          counts?: Json;
          error?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          run_id?: string | null;
          started_at?: string;
          finished_at?: string | null;
          outcome?: string;
          counts?: Json;
          error?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      order_status: "pending" | "processing" | "done" | "cancelled";
    };
    CompositeTypes: Record<never, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
