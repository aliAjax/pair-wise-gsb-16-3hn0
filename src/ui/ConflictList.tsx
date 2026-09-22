import { STATUS_LABELS } from "../data/catalog";
import type { Appointment, Audiologist, Customer, Device } from "../data/types";
import { CONFLICT_VIA_LABELS, type Conflict } from "../rules/booking";

interface Props {
  conflicts: Conflict[];
  customers: Map<string, Customer>;
  audiologists: Map<string, Audiologist>;
  devices: Map<string, Device>;
}

export function ConflictList({ conflicts, customers, audiologists, devices }: Props) {
  if (conflicts.length === 0) {
    return <p className="empty-state">当前无冲突：同一听力师或设备的重叠时段只保留了一单。</p>;
  }

  const side = (appt: Appointment) => {
    const customer = customers.get(appt.customerId)?.name ?? appt.customerId;
    const audiologist = audiologists.get(appt.audiologistId)?.name ?? appt.audiologistId;
    const device = devices.get(appt.deviceId)?.name ?? appt.deviceId;
    return `${customer} · ${audiologist} · ${appt.slot.label} · ${device} · ${STATUS_LABELS[appt.status]}`;
  };

  return (
    <div className="record-list">
      {conflicts.map((c, index) => (
        <article key={c.key} className="record-card conflict-card">
          <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
          <div>
            <h3>{CONFLICT_VIA_LABELS[c.via]} · 时段重叠</h3>
            <p>
              <b>新单</b>：{side(c.challenger)}
            </p>
            <p>
              <b>原值</b>：{side(c.keeper)}
            </p>
            <p className="conflict-tip">同一听力师或设备重叠时段只保留一单，请改期或取消其中一单。</p>
          </div>
        </article>
      ))}
    </div>
  );
}
