import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  audiologists,
  buildSeedAppointments,
  buildSlots,
  customers,
  devices,
  fmtDate,
} from "./data/catalog";
import { clearAppointments, loadAppointments, saveAppointments } from "./data/store";
import type { Appointment, Slot } from "./data/types";
import {
  canConfirm,
  cancel,
  confirm,
  confirmBlockers,
  findConflicts,
  register,
  releaseSlot,
  updateEditable,
  type Conflict,
  type EditablePatch,
  type ReviewIssue,
} from "./rules/booking";
import { BookingForm, type RegisterDraft } from "./ui/BookingForm";
import { ConflictList } from "./ui/ConflictList";
import { OccupancyBoard } from "./ui/OccupancyBoard";
import { ReviewBoard } from "./ui/ReviewBoard";

const METRIC_COLORS = ["status-watch", "status-ok", "status-danger", "status-ok"];

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={METRIC_COLORS[index % METRIC_COLORS.length]} />
    </article>
  );
}

function App() {
  const [today] = useState(() => new Date());
  const [slots] = useState<Slot[]>(() => buildSlots());
  const [appointments, setAppointments] = useState<Appointment[]>(() =>
    loadAppointments(() => buildSeedAppointments(slots))
  );

  // 预约、复核与占用全部由同一份持久化数据推导，刷新后保持一致
  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), []);
  const audiologistMap = useMemo(() => new Map(audiologists.map((a) => [a.id, a])), []);
  const deviceMap = useMemo(() => new Map(devices.map((d) => [d.id, d])), []);

  const conflicts = useMemo(() => findConflicts(appointments), [appointments]);
  const conflictsByAppt = useMemo(() => {
    const map = new Map<string, Conflict[]>();
    for (const c of conflicts) {
      for (const id of [c.keeper.id, c.challenger.id]) {
        const list = map.get(id) ?? [];
        list.push(c);
        map.set(id, list);
      }
    }
    return map;
  }, [conflicts]);

  const patchAppointment = (id: string, fn: (a: Appointment) => Appointment) => {
    setAppointments((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));
  };

  const handleRegister = (draft: RegisterDraft) => {
    const slot = slots.find((s) => s.id === draft.slotId);
    if (!slot) return;
    const now = Date.now();
    const appt = register(
      {
        id: `A-${now.toString(36).toUpperCase()}`,
        customerId: draft.customerId,
        ear: draft.ear,
        audiologistId: draft.audiologistId,
        deviceId: draft.deviceId,
        slot,
      },
      now
    );
    setAppointments((prev) => [...prev, appt]);
  };

  const handleConfirm = (id: string) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id !== id || a.status !== "pending") return a;
        const customer = customerMap.get(a.customerId);
        // 规则拦截：儿童未授权 / 耳镜超期 / 时段冲突时不得确认
        if (!customer || !canConfirm(a, prev, customer, today)) return a;
        return confirm(a, Date.now());
      })
    );
  };

  const handleRelease = (id: string) => patchAppointment(id, (a) => releaseSlot(a, Date.now()));
  const handleCancel = (id: string) => patchAppointment(id, (a) => cancel(a, Date.now()));
  const handleUpdate = (id: string, patch: EditablePatch) =>
    patchAppointment(id, (a) => updateEditable(a, patch, Date.now()));

  const handleReset = () => {
    clearAppointments();
    setAppointments(buildSeedAppointments(slots));
  };

  const getBlockers = (a: Appointment): ReviewIssue[] => {
    if (a.status !== "pending") return [];
    const customer = customerMap.get(a.customerId);
    return customer ? confirmBlockers(a, appointments, customer, today) : [];
  };

  const getConflicts = (a: Appointment): Conflict[] => conflictsByAppt.get(a.id) ?? [];

  const todayStr = fmtDate(today);
  const pendingCount = appointments.filter((a) => a.status === "pending").length;
  const confirmedCount = appointments.filter((a) => a.status === "confirmed").length;
  const todayOccupied = appointments.filter(
    (a) => a.status === "confirmed" && a.slot.date === todayStr
  ).length;

  const metrics = [
    { label: "待复核预约", value: String(pendingCount) },
    { label: "已确认预约", value: String(confirmedCount) },
    { label: "时段冲突", value: String(conflicts.length) },
    { label: "今日占用时段", value: String(todayOccupied) },
  ];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · port 5101</p>
          <h1>验配预约复核台</h1>
          <p className="subtitle">
            登记客户、耳别、听力师、设备与时段；同一听力师或设备重叠时段只保留一单，
            儿童验配未取得授权或近30天耳镜检查缺失时不得确认，改期先释放原时段，确认后冻结。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React + Vite + TypeScript + CSS</strong>
          <span>数据 / 规则 / 界面分层 · 本地持久化 · 无新增依赖</span>
          <button onClick={handleReset}>重置示例数据</button>
        </div>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} label={metric.label} value={metric.value} index={index} />
        ))}
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>预约登记</h2>
          <BookingForm
            customers={customers}
            audiologists={audiologists}
            devices={devices}
            slots={slots}
            onRegister={handleRegister}
          />
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>复核台</p>
              <h2>预约与复核</h2>
            </div>
          </div>
          <ReviewBoard
            appointments={appointments}
            slots={slots}
            customers={customerMap}
            audiologists={audiologistMap}
            devices={deviceMap}
            getBlockers={getBlockers}
            getConflicts={getConflicts}
            onConfirm={handleConfirm}
            onRelease={handleRelease}
            onCancel={handleCancel}
            onUpdate={handleUpdate}
          />
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>冲突</p>
            <h2>时段冲突（同一听力师 / 设备只保留一单）</h2>
          </div>
        </div>
        <ConflictList
          conflicts={conflicts}
          customers={customerMap}
          audiologists={audiologistMap}
          devices={deviceMap}
        />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>占用</p>
            <h2>时段占用（已确认预约）</h2>
          </div>
        </div>
        <OccupancyBoard
          slots={slots}
          confirmed={appointments.filter((a) => a.status === "confirmed")}
          customers={customerMap}
          audiologists={audiologistMap}
          devices={deviceMap}
        />
      </section>
    </main>
  );
}

export default App;
