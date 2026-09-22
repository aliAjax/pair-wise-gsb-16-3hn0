import type { Appointment } from "./types";

const STORAGE_KEY = "hxwl-01:appointments:v1";

/** 读取本地持久化的预约；无数据或数据损坏时回退到种子数据 */
export function loadAppointments(fallback: () => Appointment[]): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Appointment[];
    }
  } catch {
    // 本地数据不可用时直接使用种子数据
  }
  return fallback();
}

export function saveAppointments(appointments: Appointment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  } catch {
    // 存储满或被禁用时静默失败，界面状态仍然可用
  }
}

export function clearAppointments(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
