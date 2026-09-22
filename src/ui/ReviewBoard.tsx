import { useMemo } from "react";
import { EAR_LABELS, STATUS_LABELS, groupSlotsByDate } from "../data/catalog";
import type { Appointment, Audiologist, Customer, Device, Slot } from "../data/types";
import {
  CONFLICT_VIA_LABELS,
  sameSlot,
  type Conflict,
  type EditablePatch,
  type ReviewIssue,
} from "../rules/booking";

interface Props {
  appointments: Appointment[];
  slots: Slot[];
  customers: Map<string, Customer>;
  audiologists: Map<string, Audiologist>;
  devices: Map<string, Device>;
  getBlockers: (a: Appointment) => ReviewIssue[];
  getConflicts: (a: Appointment) => Conflict[];
  onConfirm: (id: string) => void;
  onRelease: (id: string) => void;
  onCancel: (id: string) => void;
  onUpdate: (id: string, patch: EditablePatch) => void;
}

const STATUS_RANK: Record<Appointment["status"], number> = {
  pending: 0,
  confirmed: 1,
  cancelled: 2,
};

export function ReviewBoard(props: Props) {
  const { appointments, slots, customers, audiologists, devices } = props;

  const sorted = useMemo(
    () =>
      appointments
        .slice()
        .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.createdAt - b.createdAt),
    [appointments]
  );
  const slotGroups = useMemo(() => groupSlotsByDate(slots), [slots]);

  if (sorted.length === 0) {
    return <p className="empty-state">暂无预约，请先在左侧登记。</p>;
  }

  return (
    <div className="appt-list">
      {sorted.map((appt) => {
        const customer = customers.get(appt.customerId);
        const audiologist = audiologists.get(appt.audiologistId);
        const device = devices.get(appt.deviceId);
        const issues = props.getBlockers(appt);
        const rowConflicts = props.getConflicts(appt);
        const slotInCatalog = slots.some((s) => sameSlot(s, appt.slot));

        return (
          <article key={appt.id} className={`appt-card is-${appt.status}`}>
            <div className="appt-body">
              <div className="appt-head">
                <strong>{customer?.name ?? appt.customerId}</strong>
                {customer?.isChild && <span className="tag tag-child">儿童</span>}
                <span className="tag">{EAR_LABELS[appt.ear]}</span>
                <span className={`badge badge-${appt.status}`}>{STATUS_LABELS[appt.status]}</span>
                {appt.frozen && <span className="tag tag-frozen">已冻结</span>}
              </div>

              {appt.status === "pending" ? (
                <div className="edit-row">
                  <select
                    aria-label="听力师"
                    value={appt.audiologistId}
                    onChange={(e) => props.onUpdate(appt.id, { audiologistId: e.target.value })}
                  >
                    {Array.from(audiologists.values()).map((a) => (
                      <option key={a.id} value={a.id}>
                        听力师 {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="设备"
                    value={appt.deviceId}
                    onChange={(e) => props.onUpdate(appt.id, { deviceId: e.target.value })}
                  >
                    {Array.from(devices.values()).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="时段"
                    value={appt.slot.id}
                    onChange={(e) => {
                      const next = slots.find((s) => s.id === e.target.value);
                      if (next) props.onUpdate(appt.id, { slot: next });
                    }}
                  >
                    {!slotInCatalog && (
                      <option value={appt.slot.id}>当前：{appt.slot.label}</option>
                    )}
                    {slotGroups.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.slots.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="appt-line">
                  听力师 {audiologist?.name ?? appt.audiologistId} · 设备{" "}
                  {device?.name ?? appt.deviceId} · 时段 {appt.slot.label}
                </p>
              )}

              {appt.previousSlot && (
                <p className="appt-note">
                  改期中：原时段 {appt.previousSlot.label} 已释放，选择新时段后需重新确认
                </p>
              )}

              {issues.length > 0 && (
                <ul className="issue-list">
                  {issues.map((issue) => (
                    <li key={issue.code + issue.message}>{issue.message}，不得确认</li>
                  ))}
                </ul>
              )}

              {rowConflicts.length > 0 && (
                <p className="conflict-hint">
                  时段冲突：
                  {rowConflicts
                    .map((c) => {
                      const other = c.keeper.id === appt.id ? c.challenger : c.keeper;
                      const name =
                        customers.get(other.customerId)?.name ?? other.customerId;
                      return `${name}（${CONFLICT_VIA_LABELS[c.via]} · ${other.slot.label}）`;
                    })
                    .join("、")}
                </p>
              )}
            </div>

            <div className="appt-actions">
              {appt.status === "pending" && (
                <>
                  <button
                    className="primary-action"
                    disabled={issues.length > 0}
                    title={issues.map((i) => i.message).join("；") || "确认后冻结并占用时段"}
                    onClick={() => props.onConfirm(appt.id)}
                  >
                    确认
                  </button>
                  <button className="btn-ghost" onClick={() => props.onCancel(appt.id)}>
                    取消
                  </button>
                </>
              )}
              {appt.status === "confirmed" && (
                <>
                  <button onClick={() => props.onRelease(appt.id)}>改期</button>
                  <button className="btn-ghost" onClick={() => props.onCancel(appt.id)}>
                    取消
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
