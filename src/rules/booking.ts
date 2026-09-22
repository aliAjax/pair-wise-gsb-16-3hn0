import type { Appointment, Customer, EarSide, Slot } from "../data/types";

/** 儿童验配要求耳镜检查在多少天内 */
export const OTOSCOPY_VALID_DAYS = 30;

export function sameSlot(a: Slot, b: Slot): boolean {
  return a.date === b.date && a.startMin === b.startMin && a.endMin === b.endMin;
}

export function slotsOverlap(a: Slot, b: Slot): boolean {
  return a.date === b.date && a.startMin < b.endMin && b.startMin < a.endMin;
}

export function isActive(a: Appointment): boolean {
  return a.status !== "cancelled";
}

export type ConflictVia = "audiologist" | "device" | "both";

export const CONFLICT_VIA_LABELS: Record<ConflictVia, string> = {
  audiologist: "同一听力师",
  device: "同一设备",
  both: "同一听力师与设备",
};

export interface Conflict {
  key: string;
  via: ConflictVia;
  /** 先登记的一单，即冲突中的原值 */
  keeper: Appointment;
  /** 后登记、需要调整的一单 */
  challenger: Appointment;
}

/**
 * 同一听力师或同一设备在重叠时段只保留一单。
 * 待复核与已确认都计入占用检查，先登记者为原值。
 */
export function findConflicts(appointments: Appointment[]): Conflict[] {
  const active = appointments
    .filter(isActive)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
  const conflicts: Conflict[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const keeper = active[i];
      const challenger = active[j];
      if (!slotsOverlap(keeper.slot, challenger.slot)) continue;
      const sameAudiologist = keeper.audiologistId === challenger.audiologistId;
      const sameDevice = keeper.deviceId === challenger.deviceId;
      if (!sameAudiologist && !sameDevice) continue;
      conflicts.push({
        key: `${keeper.id}__${challenger.id}`,
        via: sameAudiologist && sameDevice ? "both" : sameAudiologist ? "audiologist" : "device",
        keeper,
        challenger,
      });
    }
  }
  return conflicts;
}

export type IssueCode = "child-no-auth" | "child-otoscopy-stale" | "slot-conflict";

export interface ReviewIssue {
  code: IssueCode;
  message: string;
}

export function daysSince(dateStr: string | null, today: Date): number | null {
  if (!dateStr) return null;
  const then = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((startOfToday.getTime() - then.getTime()) / 86_400_000);
}

/** 儿童验配复核：未取得听力师授权或近三十天耳镜检查缺失时不得确认 */
export function pediatricIssues(customer: Customer, today: Date): ReviewIssue[] {
  if (!customer.isChild) return [];
  const issues: ReviewIssue[] = [];
  if (!customer.audiologistAuthorized) {
    issues.push({ code: "child-no-auth", message: "儿童验配未取得听力师授权" });
  }
  const days = daysSince(customer.lastOtoscopyDate, today);
  if (days === null) {
    issues.push({ code: "child-otoscopy-stale", message: "近30天耳镜检查缺失（无检查记录）" });
  } else if (days > OTOSCOPY_VALID_DAYS) {
    issues.push({
      code: "child-otoscopy-stale",
      message: `近30天耳镜检查缺失（最近 ${customer.lastOtoscopyDate}，已 ${days} 天）`,
    });
  }
  return issues;
}

/** 确认前复核：儿童规则 + 与已确认预约的时段占用冲突 */
export function confirmBlockers(
  appt: Appointment,
  appointments: Appointment[],
  customer: Customer,
  today: Date
): ReviewIssue[] {
  const issues = pediatricIssues(customer, today);
  for (const other of appointments) {
    if (other.id === appt.id || other.status !== "confirmed") continue;
    if (!slotsOverlap(appt.slot, other.slot)) continue;
    const sameAudiologist = other.audiologistId === appt.audiologistId;
    const sameDevice = other.deviceId === appt.deviceId;
    if (!sameAudiologist && !sameDevice) continue;
    const via =
      sameAudiologist && sameDevice ? "同一听力师与设备" : sameAudiologist ? "同一听力师" : "同一设备";
    issues.push({ code: "slot-conflict", message: `与已确认预约时段重叠（${via}）` });
  }
  return issues;
}

export function canConfirm(
  appt: Appointment,
  appointments: Appointment[],
  customer: Customer,
  today: Date
): boolean {
  return confirmBlockers(appt, appointments, customer, today).length === 0;
}

/* ---------- 状态转移（纯函数，不修改入参） ---------- */

export interface RegisterInput {
  id: string;
  customerId: string;
  ear: EarSide;
  audiologistId: string;
  deviceId: string;
  slot: Slot;
}

/** 预约登记：一律先保存为待复核 */
export function register(input: RegisterInput, now: number): Appointment {
  return {
    ...input,
    status: "pending",
    frozen: false,
    previousSlot: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** 确认：占用时段并冻结客户、设备、听力师和时段 */
export function confirm(appt: Appointment, now: number): Appointment {
  return { ...appt, status: "confirmed", frozen: true, previousSlot: null, updatedAt: now };
}

/** 改期第一步：先释放原时段，回到待复核并解冻 */
export function releaseSlot(appt: Appointment, now: number): Appointment {
  if (appt.status !== "confirmed") return appt;
  return { ...appt, status: "pending", frozen: false, previousSlot: appt.slot, updatedAt: now };
}

export type EditablePatch = Partial<Pick<Appointment, "audiologistId" | "deviceId" | "slot">>;

/** 待复核单可改听力师、设备、时段；已冻结或已取消的单不可改 */
export function updateEditable(appt: Appointment, patch: EditablePatch, now: number): Appointment {
  if (appt.frozen || appt.status === "cancelled") return appt;
  return { ...appt, ...patch, updatedAt: now };
}

export function cancel(appt: Appointment, now: number): Appointment {
  return { ...appt, status: "cancelled", frozen: false, previousSlot: null, updatedAt: now };
}
