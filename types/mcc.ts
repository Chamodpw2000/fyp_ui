export type AttackTypeLabel =
  | "Split Path"
  | "Flow Stretching"
  | "Interleaved Jamming"
  | "Asym Link Spoofing"
  | "All Attacks (Overall)";

export interface MccRow {
  attackType: AttackTypeLabel;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  mcc: number;
  /** Average detection latency in simulation cycles. null when unavailable. */
  avgTpLatency: number | null;
}

export type MccTableResponse =
  | { status: "ok"; rows: MccRow[]; updatedAt: string } // updatedAt = file mtime, ISO string
  | { status: "waiting" } // file does not exist yet
  | { status: "error"; message: string };
