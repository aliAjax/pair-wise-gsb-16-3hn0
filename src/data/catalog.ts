import type {
  Appointment,
  AppointmentStatus,
  Audiologist,
  Customer,
  Device,
  EarSide,
  Slot,
} from "./types";

export const EAR_LABELS: Record<EarSide, string> = {
  left: "左耳",
  right: "右耳",
  both: "双耳",
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "待复核",
  confirmed: "已确认",
  cancelled: "已取消",
};

export function fmtDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmtTime(min: number): string {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}

/** 客户档案：儿童验配的授权与耳镜检查记录挂在客户上 */
export const customers: Customer[] = [
  { id: "C1", name: "王建国", isChild: false, audiologistAuthorized: true, lastOtoscopyDate: daysAgo(60) },
  { id: "C2", name: "李秀兰", isChild: false, audiologistAuthorized: true, lastOtoscopyDate: daysAgo(20) },
  { id: "C3", name: "陈小明", isChild: true, audiologistAuthorized: true, lastOtoscopyDate: daysAgo(10) },
  { id: "C4", name: "林小红", isChild: true, audiologistAuthorized: false, lastOtoscopyDate: daysAgo(5) },
  { id: "C5", name: "赵天天", isChild: true, audiologistAuthorized: true, lastOtoscopyDate: daysAgo(45) },
  { id: "C6", name: "周淑芬", isChild: false, audiologistAuthorized: true, lastOtoscopyDate: null },
];

export const audiologists: Audiologist[] = [
  { id: "AU1", name: "林雪" },
  { id: "AU2", name: "何立" },
  { id: "AU3", name: "苏晴" },
];

export const devices: Device[] = [
  { id: "D1", name: "1号验配台·耳背式" },
  { id: "D2", name: "2号验配台·耳内式" },
  { id: "D3", name: "3号验配台·真耳分析" },
];

/** 每日时段（分钟），刻意保留相邻重叠的时段以覆盖冲突场景 */
const SLOT_TIMES: ReadonlyArray<readonly [number, number]> = [
  [540, 600],
  [570, 630],
  [630, 690],
  [840, 900],
  [870, 930],
  [960, 1020],
];

/** 生成今天与明天的可约时段；id 由日期与时间决定，刷新后保持稳定 */
export function buildSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let offset = 0; offset <= 1; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const date = fmtDate(d);
    for (const [startMin, endMin] of SLOT_TIMES) {
      slots.push({
        id: `slot-${date}-${startMin}`,
        date,
        startMin,
        endMin,
        label: `${date.slice(5)} ${fmtTime(startMin)}–${fmtTime(endMin)}`,
      });
    }
  }
  return slots;
}

export interface SlotGroup {
  label: string;
  slots: Slot[];
}

export function groupSlotsByDate(slots: Slot[]): SlotGroup[] {
  const today = fmtDate(new Date());
  const t = new Date();
  t.setDate(t.getDate() + 1);
  const tomorrow = fmtDate(t);
  const groups: SlotGroup[] = [];
  for (const slot of slots) {
    const label =
      slot.date === today
        ? `今天 ${slot.date.slice(5)}`
        : slot.date === tomorrow
          ? `明天 ${slot.date.slice(5)}`
          : slot.date;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.slots.push(slot);
    else groups.push({ label, slots: [slot] });
  }
  return groups;
}

/** 初始预约：覆盖已确认、时段冲突、儿童授权缺失、耳镜超期等复核场景 */
export function buildSeedAppointments(slots: Slot[]): Appointment[] {
  const todaySlots = slots.slice(0, SLOT_TIMES.length);
  const base = Date.now();
  let seq = 0;
  const mk = (
    id: string,
    customerId: string,
    ear: EarSide,
    audiologistId: string,
    deviceId: string,
    slot: Slot,
    status: AppointmentStatus
  ): Appointment => {
    const stamp = base - (100 - ++seq) * 60_000;
    return {
      id,
      customerId,
      ear,
      audiologistId,
      deviceId,
      slot,
      status,
      frozen: status === "confirmed",
      previousSlot: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
  };
  return [
    mk("A-001", "C1", "both", "AU1", "D1", todaySlots[0], "confirmed"),
    mk("A-002", "C2", "left", "AU1", "D2", todaySlots[1], "pending"),
    mk("A-003", "C3", "both", "AU2", "D2", todaySlots[3], "pending"),
    mk("A-004", "C4", "right", "AU2", "D3", todaySlots[5], "pending"),
    mk("A-005", "C5", "both", "AU3", "D2", todaySlots[4], "pending"),
  ];
}
