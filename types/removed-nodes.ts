export interface RemovedCycle {
  cycleId: number;
  /** removed_at_timestamp straight from the CSV. */
  timestamp: string;
  nodeIds: number[];
}

export type RemovedNodesResponse =
  | { status: "ok"; cycles: RemovedCycle[]; updatedAt: string } // updatedAt = file mtime, ISO string
  | { status: "waiting" } // file does not exist yet
  | { status: "error"; message: string };
