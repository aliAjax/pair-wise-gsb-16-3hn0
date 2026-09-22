export type EarSide = "left" | "right" | "both";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled";

export interface Customer {
  id: string;
  name: string;
  isChild: boolean;
  /** 儿童验配是否已取得听力师授权 */
  audiologistAuthorized: boolean;
  /** 最近一次耳镜检查日期（YYYY-MM-DD），无记录为 null */
  lastOtoscopyDate: string | null;
}

export interface Audiologist {
  id: string;
  name: string;
}

export interface Device {
  id: string;
  name: string;
}

export interface Slot {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** 自零点起的分钟数 */
  startMin: number;
  endMin: number;
  /** 展示用标签 */
  label: string;
}

export interface Appointment {
  id: string;
  customerId: string;
  ear: EarSide;
  audiologistId: string;
  deviceId: string;
  /** 时段快照：刷新后即使目录变化也能核对占用与冲突 */
  slot: Slot;
  status: AppointmentStatus;
  /** 确认后冻结客户、设备、听力师和时段 */
  frozen: boolean;
  /** 改期时被释放的原时段，确认新时段后清空 */
  previousSlot: Slot | null;
  createdAt: number;
  updatedAt: number;
}
