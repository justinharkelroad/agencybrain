export type SnapshotDay = {
  date: string;           // YYYY-MM-DD
  pass: boolean;
  met_count: number;
  required_count: number;
};

export type SnapshotMember = {
  id: string;
  name: string;
  role: "Sales" | "Service" | string;
  avatar_url?: string | null;
};

export type SnapshotResponse = {
  member: SnapshotMember;
  month: string;          // YYYY-MM
  days: SnapshotDay[];
};