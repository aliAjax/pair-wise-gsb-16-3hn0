import type { Appointment, Audiologist, Customer, Device, TimeSlot } from "./types";

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 相对今天的日期，保证“近三十天耳镜检查”规则可演示 */
function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return fmt(d);
}

export const customers: Customer[] = [
  { id: "c-liu", name: "刘一诺", isChild: true, lastOtoscopy: offsetDate(-41) },
  { id: "c-zhao", name: "赵小舟", isChild: true, lastOtoscopy: offsetDate(-9) },
  { id: "c-chen", name: "陈国华", isChild: false, lastOtoscopy: offsetDate(-60) },
  { id: "c-wang", name: "王秀兰", isChild: false, lastOtoscopy: null },
];

export const audiologists: Audiologist[] = [
  { id: "a-lin", name: "林岚", childAuthorized: true },
  { id: "a-zhou", name: "周航", childAuthorized: false },
  { id: "a-he", name: "何静", childAuthorized: true },
];

export const devices: Device[] = [
  { id: "d-fit-a", name: "验配台 A · RIC 调试" },
  { id: "d-fit-b", name: "验配台 B · BTE 调试" },
  { id: "d-rem", name: "真耳分析仪" },
];

const DAY_SLOTS: Array<[string, string]> = [
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
];

export const slots: TimeSlot[] = [0, 1].flatMap((dayOffset) =>
  DAY_SLOTS.map(([start, end], i) => ({
    id: `s-${dayOffset}-${i}`,
    date: offsetDate(dayOffset),
    start,
    end,
  }))
);

/** 首次打开的示例预约：一单已确认冻结、一单儿童待复核、一单成人待复核 */
export function seedAppointments(): Appointment[] {
  return [
    {
      id: "ap-001",
      customerId: "c-chen",
      ear: "both",
      audiologistId: "a-lin",
      deviceId: "d-fit-a",
      slotId: "s-0-0",
      status: "confirmed",
      frozen: true,
      note: "双耳高频下降，初配",
    },
    {
      id: "ap-002",
      customerId: "c-liu",
      ear: "left",
      audiologistId: "a-zhou",
      deviceId: "d-rem",
      slotId: "s-0-1",
      status: "pending",
      frozen: false,
      note: "儿童验配，待复核",
    },
    {
      id: "ap-003",
      customerId: "c-wang",
      ear: "right",
      audiologistId: "a-he",
      deviceId: "d-fit-b",
      slotId: "s-1-2",
      status: "pending",
      frozen: false,
      note: "复调",
    },
  ];
}
