import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import { audiologists, customers, devices, seedAppointments, slots } from "./data";
import {
  cancelAppointment,
  childBlockReasons,
  confirmAppointment,
  occupancyRows,
  registerAppointment,
  rescheduleAppointment,
  slotLabel,
  type DataSet,
  type OpResult,
} from "./rules";
import { loadState, saveState, type PersistedState } from "./store";
import { EAR_LABELS, STATUS_LABELS, type Ear } from "./types";

const data: DataSet = { customers, audiologists, devices, slots };

const customerOf = (id: string) => customers.find((c) => c.id === id);
const audiologistOf = (id: string) => audiologists.find((a) => a.id === id);
const deviceOf = (id: string) => devices.find((d) => d.id === id);
const slotOf = (id: string) => slots.find((s) => s.id === id);

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tone} />
    </article>
  );
}

export default function App() {
  const [state, setState] = useState<PersistedState>(loadState);
  const [notice, setNotice] = useState<string[]>([]);
  const [draft, setDraft] = useState({
    customerId: customers[0].id,
    ear: "both" as Ear,
    audiologistId: audiologists[0].id,
    deviceId: devices[0].id,
    slotId: slots[0].id,
    note: "",
  });
  const [rescheduleChoice, setRescheduleChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    saveState(state);
  }, [state]);

  const active = state.appointments.filter((a) => a.status !== "cancelled");
  const pending = state.appointments.filter((a) => a.status === "pending");
  const confirmed = state.appointments.filter((a) => a.status === "confirmed");
  const occupiedSlotCount = new Set(active.map((a) => a.slotId)).size;
  const occupancy = useMemo(() => occupancyRows(data, state.appointments), [state.appointments]);

  function apply(result: OpResult) {
    setState((prev) => ({
      appointments: result.appointments,
      conflictLog: [...result.conflicts, ...prev.conflictLog].slice(0, 50),
    }));
    const messages = [...result.reasons];
    if (result.ok && result.reasons.length > 0) messages.push("该单已保存为待复核，满足条件后方可确认");
    if (result.conflicts.length > 0) {
      messages.push(`同一听力师或设备的重叠时段只保留一单，已保留原单（见冲突记录 ${result.conflicts.length} 条）`);
    }
    setNotice(messages);
  }

  const patchDraft = (part: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...part }));
  const submit = (intent: "pending" | "confirm") => apply(registerAppointment(data, state.appointments, draft, intent));
  const confirm = (id: string) => apply(confirmAppointment(data, state.appointments, id));
  const cancel = (id: string) => apply(cancelAppointment(state.appointments, id));
  const reschedule = (id: string) => {
    const slotId = rescheduleChoice[id];
    if (!slotId) {
      setNotice(["请先选择要改期的时段"]);
      return;
    }
    apply(rescheduleAppointment(data, state.appointments, id, slotId));
  };
  const resetAll = () => {
    setState({ appointments: seedAppointments(), conflictLog: [] });
    setNotice([]);
  };

  const draftCustomer = customerOf(draft.customerId);
  const draftAudiologist = audiologistOf(draft.audiologistId);
  const draftSlot = slotOf(draft.slotId);
  const draftReasons =
    draftCustomer && draftAudiologist && draftSlot
      ? childBlockReasons(draftCustomer, draftAudiologist, draftSlot)
      : [];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · port 5101</p>
          <h1>验配预约复核台</h1>
          <p className="subtitle">
            登记客户、耳别、听力师、设备与时段；同一听力师或设备的重叠时段只保留一单。儿童验配未取得听力师授权或近三十天耳镜检查缺失时不得确认，仅可保存待复核；确认后冻结客户、设备、听力师与时段，改期先释放原时段。
          </p>
        </div>
        <div className="stack-card">
          <span>数据 / 规则 / 界面分离</span>
          <strong>data.ts 数据 · rules.ts 规则 · App.tsx 界面</strong>
          <span>本地持久化，刷新后预约、复核与占用一致</span>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="待复核预约" value={pending.length} tone="status-watch" />
        <MetricCard label="已确认冻结" value={confirmed.length} tone="status-ok" />
        <MetricCard label="占用时段" value={occupiedSlotCount} tone="status-ok" />
        <MetricCard label="冲突记录" value={state.conflictLog.length} tone="status-danger" />
      </section>

      {notice.length > 0 && (
        <div className="notice">
          <strong>操作结果</strong>
          <ul>
            {notice.map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="workspace">
        <aside className="panel narrow">
          <h2>听力师</h2>
          <div className="chips">
            {audiologists.map((a) => (
              <span key={a.id}>
                {a.name} · {a.childAuthorized ? "儿童授权" : "未授权儿童"}
              </span>
            ))}
          </div>
          <h2>设备</h2>
          <div className="chips">
            {devices.map((d) => (
              <span key={d.id}>{d.name}</span>
            ))}
          </div>
          <h2>复核规则</h2>
          <ul className="rule-list">
            <li>同一听力师或设备，重叠时段只保留一单</li>
            <li>儿童验配须取得听力师授权</li>
            <li>儿童须有近三十天耳镜检查</li>
            <li>确认后冻结客户、设备、听力师与时段</li>
            <li>改期先释放原时段，重新确认再冻结</li>
          </ul>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>预约登记</p>
              <h2>登记客户、耳别、听力师、设备与时段</h2>
            </div>
          </div>
          <div className="field-grid">
            <label>
              <span>客户</span>
              <select value={draft.customerId} onChange={(e) => patchDraft({ customerId: e.target.value })}>
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
              <select value={draft.ear} onChange={(e) => patchDraft({ ear: e.target.value as Ear })}>
                {Object.entries(EAR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>听力师</span>
              <select value={draft.audiologistId} onChange={(e) => patchDraft({ audiologistId: e.target.value })}>
                {audiologists.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.childAuthorized ? "（儿童授权）" : "（未授权儿童）"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>设备</span>
              <select value={draft.deviceId} onChange={(e) => patchDraft({ deviceId: e.target.value })}>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>时段</span>
              <select value={draft.slotId} onChange={(e) => patchDraft({ slotId: e.target.value })}>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {slotLabel(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>备注</span>
              <input
                value={draft.note}
                placeholder="如：初配 / 复调"
                onChange={(e) => patchDraft({ note: e.target.value })}
              />
            </label>
          </div>
          {draftCustomer?.isChild && (
            <div className="child-check">
              <span>
                儿童验配复核 · 最近耳镜检查：{draftCustomer.lastOtoscopy ?? "无记录"} · 听力师：
                {draftAudiologist?.childAuthorized ? "已授权" : "未授权"}
              </span>
              <div>
                {draftReasons.length > 0 ? (
                  draftReasons.map((r) => (
                    <span className="tag" key={r}>
                      {r}
                    </span>
                  ))
                ) : (
                  <span className="tag tag-ok">满足确认条件</span>
                )}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button onClick={() => submit("pending")}>保存待复核</button>
            <button className="primary-action" onClick={() => submit("confirm")}>
              确认预约
            </button>
          </div>
        </section>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>复核队列</p>
            <h2>待复核预约（{pending.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {pending.length === 0 && <p className="empty">暂无待复核预约</p>}
          {pending.map((ap) => {
            const customer = customerOf(ap.customerId);
            const audiologist = audiologistOf(ap.audiologistId);
            const slot = slotOf(ap.slotId);
            const reasons = customer && audiologist && slot ? childBlockReasons(customer, audiologist, slot) : [];
            return (
              <article className="record-card with-actions" key={ap.id}>
                <div className="record-index">{ap.id.slice(-3)}</div>
                <div>
                  <h3>
                    {customer?.name} · {EAR_LABELS[ap.ear]}
                    {customer?.isChild && <span className="tag">儿童</span>}
                  </h3>
                  <p>
                    {audiologist?.name} · {deviceOf(ap.deviceId)?.name} · {slot ? slotLabel(slot) : ap.slotId}
                    {ap.note ? ` · ${ap.note}` : ""}
                  </p>
                  <div>
                    {reasons.length > 0 ? (
                      reasons.map((r) => (
                        <span className="tag" key={r}>
                          {r}
                        </span>
                      ))
                    ) : (
                      <span className="tag tag-ok">符合确认条件</span>
                    )}
                  </div>
                </div>
                <div className="row-actions">
                  <button className="primary-action compact" onClick={() => confirm(ap.id)}>
                    确认
                  </button>
                  <button className="compact danger" onClick={() => cancel(ap.id)}>
                    取消
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>预约总览</p>
            <h2>全部预约（{state.appointments.length}）</h2>
          </div>
          <button onClick={resetAll}>恢复示例数据</button>
        </div>
        <div className="table-wrap">
          <table className="schedule">
            <thead>
              <tr>
                <th>单号</th>
                <th>客户</th>
                <th>耳别</th>
                <th>听力师</th>
                <th>设备</th>
                <th>时段</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.appointments.map((ap) => (
                <tr key={ap.id} className={ap.status === "cancelled" ? "muted-row" : ""}>
                  <td>{ap.id}</td>
                  <td>
                    {customerOf(ap.customerId)?.name}
                    {customerOf(ap.customerId)?.isChild && <span className="tag">儿童</span>}
                  </td>
                  <td>{EAR_LABELS[ap.ear]}</td>
                  <td>{audiologistOf(ap.audiologistId)?.name}</td>
                  <td>{deviceOf(ap.deviceId)?.name}</td>
                  <td>{slotOf(ap.slotId) ? slotLabel(slotOf(ap.slotId)!) : ap.slotId}</td>
                  <td>
                    <span className={`badge badge-${ap.status}`}>{STATUS_LABELS[ap.status]}</span>
                    {ap.frozen && <span className="badge badge-frozen">🔒 已冻结</span>}
                  </td>
                  <td>
                    {ap.status !== "cancelled" && (
                      <div className="row-actions">
                        <select
                          value={rescheduleChoice[ap.id] ?? ""}
                          onChange={(e) =>
                            setRescheduleChoice((prev) => ({ ...prev, [ap.id]: e.target.value }))
                          }
                        >
                          <option value="">改期至…</option>
                          {slots
                            .filter((s) => s.id !== ap.slotId)
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {slotLabel(s)}
                              </option>
                            ))}
                        </select>
                        <button className="compact" onClick={() => reschedule(ap.id)}>
                          改期
                        </button>
                        {ap.status === "pending" && (
                          <button className="compact primary-action" onClick={() => confirm(ap.id)}>
                            确认
                          </button>
                        )}
                        <button className="compact danger" onClick={() => cancel(ap.id)}>
                          取消
                        </button>
                      </div>
                    )}
                    {ap.frozen && <p className="frozen-hint">已冻结，仅可通过改期释放原时段</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>时段占用</p>
            <h2>听力师与设备占用（{occupancy.length}）</h2>
          </div>
        </div>
        <div className="record-list">
          {occupancy.length === 0 && <p className="empty">暂无占用</p>}
          {occupancy.map((row) => (
            <article className="record-card" key={row.appointmentId}>
              <div className="record-index">{row.slot.start.slice(0, 2)}</div>
              <div>
                <h3>{slotLabel(row.slot)}</h3>
                <p>
                  {row.customer.name} · {row.audiologist.name} · {row.device.name} ·{" "}
                  {STATUS_LABELS[row.status]}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p>冲突记录</p>
            <h2>时段冲突（{state.conflictLog.length}）</h2>
          </div>
          {state.conflictLog.length > 0 && (
            <button onClick={() => setState((prev) => ({ ...prev, conflictLog: [] }))}>清空记录</button>
          )}
        </div>
        <div className="record-list">
          {state.conflictLog.length === 0 && <p className="empty">暂无冲突</p>}
          {state.conflictLog.map((cf) => (
            <article className="conflict-card" key={cf.id}>
              <p>
                客户 {cf.customer} · 听力师 {cf.audiologist} · 时段 {cf.slot}
              </p>
              <p>
                冲突项：{cf.field} · 原值：<span className="original">{cf.originalValue}</span>
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
