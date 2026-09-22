export type Ear = "left" | "right" | "both";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled";

export interface Customer {
  id: string;
  name: string;
  isChild: boolean;
  /** 最近一次耳镜检查日期 YYYY-MM-DD，无记录为 null */
  lastOtoscopy: string | null;
}

export interface Audiologist {
  id: string;
  name: string;
  /** 是否取得儿童验配授权 */
  childAuthorized: boolean;
}

export interface Device {
  id: string;
  name: string;
}

export interface TimeSlot {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface Appointment {
  id: string;
  customerId: string;
  ear: Ear;
  audiologistId: string;
  deviceId: string;
  slotId: string;
  status: AppointmentStatus;
  /** 确认后冻结客户、设备、听力师与时段 */
  frozen: boolean;
  note: string;
}

/** 冲突记录：列出客户、听力师、时段与原值 */
export interface ConflictRecord {
  id: string;
  customer: string;
  audiologist: string;
  slot: string;
  field: string;
  originalValue: string;
}

export const EAR_LABELS: Record<Ear, string> = {
  left: "左耳",
  right: "右耳",
  both: "双耳",
};

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "待复核",
  confirmed: "已确认",
  cancelled: "已取消",
};
