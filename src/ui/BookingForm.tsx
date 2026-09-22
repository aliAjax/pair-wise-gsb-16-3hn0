import { useMemo, useState } from "react";
import { EAR_LABELS, groupSlotsByDate } from "../data/catalog";
import type { Audiologist, Customer, Device, EarSide, Slot } from "../data/types";

export interface RegisterDraft {
  customerId: string;
  ear: EarSide;
  audiologistId: string;
  deviceId: string;
  slotId: string;
}

interface Props {
  customers: Customer[];
  audiologists: Audiologist[];
  devices: Device[];
  slots: Slot[];
  onRegister: (draft: RegisterDraft) => void;
}

export function BookingForm({ customers, audiologists, devices, slots, onRegister }: Props) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [ear, setEar] = useState<EarSide>("both");
  const [audiologistId, setAudiologistId] = useState(audiologists[0]?.id ?? "");
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [slotId, setSlotId] = useState(slots[0]?.id ?? "");

  const slotGroups = useMemo(() => groupSlotsByDate(slots), [slots]);

  const submit = () => {
    if (!customerId || !audiologistId || !deviceId || !slotId) return;
    onRegister({ customerId, ear, audiologistId, deviceId, slotId });
  };

  return (
    <div className="form-grid">
      <label>
        <span>客户</span>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.isChild ? "（儿童）" : ""}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>耳别</span>
        <select value={ear} onChange={(e) => setEar(e.target.value as EarSide)}>
          {(Object.keys(EAR_LABELS) as EarSide[]).map((key) => (
            <option key={key} value={key}>
              {EAR_LABELS[key]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>听力师</span>
        <select value={audiologistId} onChange={(e) => setAudiologistId(e.target.value)}>
          {audiologists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>设备</span>
        <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>时段</span>
        <select value={slotId} onChange={(e) => setSlotId(e.target.value)}>
          {slotGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.slots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label.slice(6)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <button className="primary-action" onClick={submit}>
        登记预约
      </button>
      <p className="form-note">
        登记后先保存为待复核；儿童验配需取得听力师授权且近30天内有耳镜检查才可确认。
      </p>
    </div>
  );
}
