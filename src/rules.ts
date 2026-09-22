import type {
  Appointment,
  AppointmentStatus,
  Audiologist,
  ConflictRecord,
  Customer,
  Device,
  Ear,
  TimeSlot,
} from "./types";

export interface DataSet {
  customers: Customer[];
  audiologists: Audiologist[];
  devices: Device[];
  slots: TimeSlot[];
}

export interface AppointmentDraft {
  customerId: string;
  ear: Ear;
  audiologistId: string;
  deviceId: string;
  slotId: string;
  note: string;
}

export interface OpResult {
  ok: boolean;
  appointments: Appointment[];
  conflicts: ConflictRecord[];
  reasons: string[];
}

export interface ConflictHit {
  appointment: Appointment;
  field: "audiologist" | "device";
}

export function slotLabel(slot: TimeSlot): string {
  return `${slot.date} ${slot.start}–${slot.end}`;
}

export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return a.date === b.date && a.start < b.end && b.start < a.end;
}

export function isActive(a: Appointment): boolean {
  return a.status !== "cancelled";
}

/**
 * 同一听力师或同一设备在重叠时段只保留一单。
 * candidate 带 id 时排除自身（用于改期 / 确认已存在的单）。
 */
export function detectConflicts(
  appointments: Appointment[],
  slots: TimeSlot[],
  candidate: Pick<Appointment, "audiologistId" | "deviceId" | "slotId"> & { id?: string }
): ConflictHit[] {
  const slot = slots.find((s) => s.id === candidate.slotId);
  if (!slot) return [];
  const hits: ConflictHit[] = [];
  for (const other of appointments) {
    if (!isActive(other) || other.id === candidate.id) continue;
    const sameAudiologist = other.audiologistId === candidate.audiologistId;
    const sameDevice = other.deviceId === candidate.deviceId;
    if (!sameAudiologist && !sameDevice) continue;
    const otherSlot = slots.find((s) => s.id === other.slotId);
    if (!otherSlot || !slotsOverlap(slot, otherSlot)) continue;
    hits.push({ appointment: other, field: sameAudiologist ? "audiologist" : "device" });
  }
  return hits;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** 儿童验配确认门槛：听力师授权 + 近三十天耳镜检查 */
export function childBlockReasons(
  customer: Customer,
  audiologist: Audiologist,
  slot: TimeSlot
): string[] {
  if (!customer.isChild) return [];
  const reasons: string[] = [];
  if (!audiologist.childAuthorized) reasons.push("儿童验配未取得听力师授权");
  const gap = customer.lastOtoscopy ? daysBetween(customer.lastOtoscopy, slot.date) : Infinity;
  if (!customer.lastOtoscopy || gap < 0 || gap > 30) reasons.push("近三十天耳镜检查缺失");
  return reasons;
}

/** 冲突记录：列出客户、听力师、时段与原值（占用单持有的资源） */
export function toConflictRecords(
  hits: ConflictHit[],
  data: DataSet,
  attempted: Pick<Appointment, "customerId" | "audiologistId" | "slotId">
): ConflictRecord[] {
  const customer = data.customers.find((c) => c.id === attempted.customerId);
  const audiologist = data.audiologists.find((a) => a.id === attempted.audiologistId);
  const slot = data.slots.find((s) => s.id === attempted.slotId);
  return hits.map((hit, index) => {
    const holder = data.customers.find((c) => c.id === hit.appointment.customerId);
    const resource =
      hit.field === "audiologist"
        ? data.audiologists.find((a) => a.id === hit.appointment.audiologistId)?.name
        : data.devices.find((d) => d.id === hit.appointment.deviceId)?.name;
    return {
      id: `cf-${Date.now()}-${index}`,
      customer: customer?.name ?? attempted.customerId,
      audiologist: audiologist?.name ?? attempted.audiologistId,
      slot: slot ? slotLabel(slot) : attempted.slotId,
      field: hit.field === "audiologist" ? "听力师" : "设备",
      originalValue: `${resource ?? "?"}（占用单 ${hit.appointment.id} · ${holder?.name ?? hit.appointment.customerId}）`,
    };
  });
}

function fail(appointments: Appointment[], conflicts: ConflictRecord[] = [], reasons: string[] = []): OpResult {
  return { ok: false, appointments, conflicts, reasons };
}

function nextId(appointments: Appointment[]): string {
  let n = appointments.length + 1;
  let id = `ap-${String(n).padStart(3, "0")}`;
  while (appointments.some((a) => a.id === id)) {
    n += 1;
    id = `ap-${String(n).padStart(3, "0")}`;
  }
  return id;
}

/**
 * 登记预约。intent 为 confirm 时若儿童复核条件不满足，
 * 不得确认，只保存为待复核（reasons 非空说明原因）。
 */
export function registerAppointment(
  data: DataSet,
  appointments: Appointment[],
  draft: AppointmentDraft,
  intent: "pending" | "confirm"
): OpResult {
  const customer = data.customers.find((c) => c.id === draft.customerId);
  const audiologist = data.audiologists.find((a) => a.id === draft.audiologistId);
  const device = data.devices.find((d) => d.id === draft.deviceId);
  const slot = data.slots.find((s) => s.id === draft.slotId);
  if (!customer || !audiologist || !device || !slot) {
    return fail(appointments, [], ["登记信息不完整"]);
  }
  const hits = detectConflicts(appointments, data.slots, draft);
  if (hits.length > 0) return fail(appointments, toConflictRecords(hits, data, draft));

  const reasons = childBlockReasons(customer, audiologist, slot);
  const canConfirm = intent === "confirm" && reasons.length === 0;
  const appointment: Appointment = {
    id: nextId(appointments),
    ...draft,
    status: canConfirm ? "confirmed" : "pending",
    frozen: canConfirm,
  };
  return { ok: true, appointments: [...appointments, appointment], conflicts: [], reasons };
}

/** 确认预约：通过冲突与儿童复核后冻结客户、设备、听力师与时段 */
export function confirmAppointment(data: DataSet, appointments: Appointment[], id: string): OpResult {
  const ap = appointments.find((a) => a.id === id);
  if (!ap || !isActive(ap)) return fail(appointments, [], ["预约不存在或已取消"]);
  if (ap.status === "confirmed") return { ok: true, appointments, conflicts: [], reasons: [] };

  const hits = detectConflicts(appointments, data.slots, ap);
  if (hits.length > 0) return fail(appointments, toConflictRecords(hits, data, ap));

  const customer = data.customers.find((c) => c.id === ap.customerId);
  const audiologist = data.audiologists.find((a) => a.id === ap.audiologistId);
  const slot = data.slots.find((s) => s.id === ap.slotId);
  const reasons = customer && audiologist && slot ? childBlockReasons(customer, audiologist, slot) : ["登记信息不完整"];
  if (reasons.length > 0) return fail(appointments, [], reasons);

  return {
    ok: true,
    appointments: appointments.map((a) => (a.id === id ? { ...a, status: "confirmed", frozen: true } : a)),
    conflicts: [],
    reasons: [],
  };
}

/**
 * 改期：先释放原时段（排除自身后再查冲突），
 * 改期后回到待复核并解除冻结，需重新确认才再次冻结。
 */
export function rescheduleAppointment(
  data: DataSet,
  appointments: Appointment[],
  id: string,
  newSlotId: string
): OpResult {
  const ap = appointments.find((a) => a.id === id);
  if (!ap || !isActive(ap)) return fail(appointments, [], ["预约不存在或已取消"]);
  if (ap.slotId === newSlotId) return fail(appointments, [], ["新时段与原时段相同"]);
  const slot = data.slots.find((s) => s.id === newSlotId);
  if (!slot) return fail(appointments, [], ["时段不存在"]);

  const hits = detectConflicts(appointments, data.slots, { ...ap, slotId: newSlotId });
  if (hits.length > 0) return fail(appointments, toConflictRecords(hits, data, ap));

  return {
    ok: true,
    appointments: appointments.map((a) =>
      a.id === id ? { ...a, slotId: newSlotId, status: "pending", frozen: false } : a
    ),
    conflicts: [],
    reasons: [],
  };
}

/** 取消预约：释放占用的听力师 / 设备 / 时段 */
export function cancelAppointment(appointments: Appointment[], id: string): OpResult {
  const ap = appointments.find((a) => a.id === id);
  if (!ap || !isActive(ap)) return fail(appointments, [], ["预约不存在或已取消"]);
  return {
    ok: true,
    appointments: appointments.map((a) => (a.id === id ? { ...a, status: "cancelled", frozen: false } : a)),
    conflicts: [],
    reasons: [],
  };
}

export interface OccupancyRow {
  appointmentId: string;
  slot: TimeSlot;
  customer: Customer;
  audiologist: Audiologist;
  device: Device;
  status: AppointmentStatus;
}

/** 占用视图由在约单直接推导，保证预约、复核与占用一致 */
export function occupancyRows(data: DataSet, appointments: Appointment[]): OccupancyRow[] {
  return appointments
    .filter(isActive)
    .map((ap) => ({
      appointmentId: ap.id,
      slot: data.slots.find((s) => s.id === ap.slotId),
      customer: data.customers.find((c) => c.id === ap.customerId),
      audiologist: data.audiologists.find((a) => a.id === ap.audiologistId),
      device: data.devices.find((d) => d.id === ap.deviceId),
      status: ap.status,
    }))
    .filter((r): r is OccupancyRow => Boolean(r.slot && r.customer && r.audiologist && r.device))
    .sort((a, b) => (a.slot.date + a.slot.start).localeCompare(b.slot.date + b.slot.start));
}
