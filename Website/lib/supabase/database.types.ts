import type { CloudRecord } from "../cloud-records";

type WorkspaceRevision = {
  revision_id: string;
  user_id: string;
  workspace_id: string;
  modified_at: string;
  received_at: string;
  record: CloudRecord;
  expected_revision_id?: string | null;
};

type FactMemoryRow = {
  user_id: string;
  fact_id: string;
  content: Record<string, unknown>;
  known: boolean;
  fingerprint: string;
};

export type Database = {
  public: {
    Tables: {
      account_credentials: {
        Row: { user_id: string; provider: string; api_key: string };
        Insert: { user_id: string; provider: string; api_key: string };
        Update: { api_key?: string };
        Relationships: [];
      };
      workspace_revisions: {
        Row: WorkspaceRevision;
        Insert: Omit<WorkspaceRevision, "received_at"> & { received_at?: string };
        Update: Partial<WorkspaceRevision>;
        Relationships: [];
      };
      fact_memory: {
        Row: FactMemoryRow;
        Insert: FactMemoryRow;
        Update: Partial<FactMemoryRow>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      latest_workspace_revisions: {
        Args: Record<string, never>;
        Returns: WorkspaceRevision[];
      };
      remember_facts: {
        Args: { items: unknown };
        Returns: undefined;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};
