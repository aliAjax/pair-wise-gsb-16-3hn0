import { useMemo } from "react";
import { fmtTime, groupSlotsByDate } from "../data/catalog";
import type { Appointment, Audiologist, Customer, Device, Slot } from "../data/types";
import { sameSlot } from "../rules/booking";

interface Props {
  slots: Slot[];
  confirmed: Appointment[];
  customers: Map<string, Customer>;
  audiologists: Map<string, Audiologist>;
  devices: Map<string, Device>;
}

/** 时段占用看板：只统计已确认预约，与复核台数据同源，刷新后一致 */
export function OccupancyBoard({ slots, confirmed, customers, audiologists, devices }: Props) {
  const groups = useMemo(() => groupSlotsByDate(slots), [slots]);

  return (
    <div className="occ-board">
      {groups.map((group) => (
        <div key={group.label} className="occ-group">
          <h3 className="occ-date">{group.label}</h3>
          <table className="occ-table">
            <thead>
              <tr>
                <th>时段</th>
                <th>占用</th>
                <th>预约明细（客户 · 听力师 · 设备）</th>
              </tr>
            </thead>
            <tbody>
              {group.slots.map((slot) => {
                const occupied = confirmed.filter((a) => sameSlot(a.slot, slot));
                return (
                  <tr key={slot.id}>
                    <td className="occ-time">
                      {fmtTime(slot.startMin)}–{fmtTime(slot.endMin)}
                    </td>
                    <td>
                      {occupied.length > 0 ? (
                        <span className="occ-pill occ-busy">占用 {occupied.length}</span>
                      ) : (
                        <span className="occ-pill occ-free">空闲</span>
                      )}
                    </td>
                    <td>
                      <div className="occ-chips">
                        {occupied.map((a) => (
                          <span key={a.id} className="occ-chip">
                            {customers.get(a.customerId)?.name ?? a.customerId} ·{" "}
                            {audiologists.get(a.audiologistId)?.name ?? a.audiologistId} ·{" "}
                            {devices.get(a.deviceId)?.name ?? a.deviceId}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
