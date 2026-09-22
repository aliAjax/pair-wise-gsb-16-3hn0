import { seedAppointments } from "./data";
import type { Appointment, ConflictRecord } from "./types";

export interface PersistedState {
  appointments: Appointment[];
  conflictLog: ConflictRecord[];
}

const STORAGE_KEY = "hxwl-01.fitting-review.v1";

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (Array.isArray(parsed.appointments)) {
        return {
          appointments: parsed.appointments,
          conflictLog: Array.isArray(parsed.conflictLog) ? parsed.conflictLog : [],
        };
      }
    }
  } catch {
    // 本地数据损坏时回退到示例数据
  }
  return { appointments: seedAppointments(), conflictLog: [] };
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时保持内存态
  }
}
