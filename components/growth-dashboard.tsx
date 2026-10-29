"use client";

import {
  ArrowUpRight,
  CalendarRange,
  Check,
  ChevronRight,
  CircleGauge,
  Compass,
  Download,
  FileText,
  Flag,
  LayoutDashboard,
  Loader2,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Sun,
  Target,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { migrateGrowthState, type GrowthState, type StateEnvelope } from "@/lib/growth-state";

type Props = { displayName: string };

const sections = [
  { id: "overview", label: "Обзор", icon: LayoutDashboard },
  { id: "beacon", label: "Мой маяк", icon: Compass },
  { id: "passport", label: "Паспорт роста", icon: FileText },
  { id: "sprint", label: "12 недель", icon: CalendarRange },
  { id: "reports", label: "Отчеты", icon: Flag },
  { id: "wheel", label: "Колесо жизни", icon: CircleGauge },
];

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{children}</span>;
}

function TextArea({ value, onChange, placeholder, rows = 4, readOnly = false }: { value: string; onChange: (value: string) => void; placeholder: string; rows?: number; readOnly?: boolean }) {
  return <textarea className="w-full resize-none rounded-2xl border bg-white/80 px-4 py-3 text-sm leading-6 outline-none transition focus:border-[#0056FF] focus:ring-4 focus:ring-[#0056FF]/10 dark:bg-white/5" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} readOnly={readOnly} />;
}

function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return <input className="w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm outline-none transition focus:border-[#0056FF] focus:ring-4 focus:ring-[#0056FF]/10 dark:bg-white/5" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} />;
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[26px] border bg-white/85 shadow-[0_16px_50px_rgba(15,23,42,.06)] backdrop-blur dark:bg-[#111b31]/90 ${className}`}>{children}</section>;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="mb-6"><p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#0056FF]">{eyebrow}</p><h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p></div>;
}

function WheelChart({ values }: { values: GrowthState["wheel"] }) {
  const points = useMemo(() => {
    return values.map((item, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
      const radius = 86 * (item.score / 10);
      return `${120 + Math.cos(angle) * radius},${120 + Math.sin(angle) * radius}`;
    }).join(" ");
  }, [values]);

  return <svg viewBox="0 0 240 240" className="mx-auto aspect-square w-full max-w-[310px]" aria-label="Колесо жизни">
    {[2, 4, 6, 8, 10].map((score) => <circle key={score} cx="120" cy="120" r={(86 * score) / 10} fill="none" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />)}
    {values.map((_, index) => { const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length; return <line key={index} x1="120" y1="120" x2={120 + Math.cos(angle) * 86} y2={120 + Math.sin(angle) * 86} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />; })}
    <polygon points={points} fill="#0056FF" fillOpacity=".28" stroke="#0056FF" strokeWidth="3" strokeLinejoin="round" />
    {points.split(" ").map((point, index) => { const [x, y] = point.split(","); return <circle key={index} cx={x} cy={y} r="4" fill="#0056FF" stroke="white" strokeWidth="2" />; })}
  </svg>;
}

export function GrowthDashboard({ displayName }: Props) {
  const [envelope, setEnvelope] = useState<StateEnvelope | null>(null);
  const [draft, setDraft] = useState<GrowthState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState("overview");
  const [dark, setDark] = useState(false);
  const [newTask, setNewTask] = useState("");
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("gruppa-rosta-theme");
    const nextDark = savedTheme ? savedTheme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    void load();
  }, []);

  async function load() {
    setStatus("loading");
    const response = await fetch("/api/state", { cache: "no-store" });
    if (!response.ok) { setStatus("error"); setMessage("Не удалось загрузить личные данные"); return; }
    const data = (await response.json()) as StateEnvelope;
    setEnvelope(data); setDraft(data.state); setStatus("ready");
  }

  function update(mutator: (state: GrowthState) => GrowthState) {
    setDraft((current) => current ? mutator(structuredClone(current)) : current);
    setStatus("ready");
  }

  async function save(reason = "dashboard_update") {
    if (!draft || !envelope) return;
    setStatus("saving"); setMessage("");
    const response = await fetch("/api/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state: draft, revision: envelope.revision, reason }) });
    const data = (await response.json()) as StateEnvelope & { error?: string };
    if (!response.ok) { setStatus("error"); setMessage(data.error || "Не удалось сохранить данные"); return; }
    setEnvelope(data); setDraft(data.state); setStatus("saved"); setTimeout(() => setStatus("ready"), 1800);
  }

  function toggleTheme() {
    const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("gruppa-rosta-theme", next ? "dark" : "light");
  }

  function exportData() {
    if (!draft || !envelope) return;
    const blob = new Blob([JSON.stringify({ format: "gruppa-rosta-snapshot", exportedAt: new Date().toISOString(), state: draft, revision: envelope.revision }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `gruppa-rosta-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      const value = JSON.parse(await file.text()) as unknown;
      const state = value && typeof value === "object" && "state" in value
        ? (value as { state?: GrowthState }).state
        : (value as GrowthState);
      if (!state) throw new Error("В копии нет данных");
      setDraft(migrateGrowthState(state)); setStatus("ready"); setMessage("Копия загружена в черновик. Нажмите «Сохранить», чтобы восстановить данные.");
    } catch (error) { setStatus("error"); setMessage(error instanceof Error ? error.message : "Не удалось прочитать копию"); }
  }

  function scrollTo(id: string) { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function addTask() {
    if (!newTask.trim()) return;
    update((state) => { state.currentWeek.tasks.push({ id: crypto.randomUUID(), title: newTask.trim(), done: false, priority: "main" }); return state; }); setNewTask("");
  }

  const taskProgress = draft?.currentWeek.tasks.length ? Math.round((draft.currentWeek.tasks.filter((task) => task.done).length / draft.currentWeek.tasks.length) * 100) : 0;

  if (!draft || !envelope) return <main className="grid min-h-screen place-items-center bg-[#0F172A] text-white"><div className="text-center"><Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[#2277FF]" /><p className="text-sm font-bold">Загружаю личное пространство</p>{message && <p className="mt-2 text-xs text-red-300">{message}</p>}</div></main>;

  return <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(0,86,255,.09),transparent_28%),var(--background)] text-foreground">
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] border-r bg-white/90 px-5 py-6 backdrop-blur-xl dark:bg-[#0b1426]/95 lg:flex lg:flex-col">
      <img src="/brand/logo-color.svg" alt="ГРУППА РОСТА" className="h-auto w-[172px] dark:hidden" /><img src="/brand/logo-white.svg" alt="ГРУППА РОСТА" className="hidden h-auto w-[172px] dark:block" />
      <p className="mb-8 mt-4 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Личная система роста</p>
      <nav className="space-y-1.5">{sections.map((section) => { const Icon = section.icon; const selected = active === section.id; return <button key={section.id} onClick={() => scrollTo(section.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${selected ? "bg-[#0056FF] text-white shadow-lg shadow-[#0056FF]/20" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"}`}><Icon className="h-4 w-4" />{section.label}</button>; })}</nav>
      <div className="mt-auto rounded-2xl bg-[#0F172A] p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-blue-300">Два специалиста</p><p className="mt-2 text-sm font-extrabold">НОРД + РИТМ</p><p className="mt-1 text-[11px] leading-4 text-slate-300">Курс и действия используют одно личное хранилище.</p></div>
    </aside>

    <div className="lg:pl-[252px]">
      <header className="sticky top-0 z-30 border-b bg-white/82 px-4 py-3 backdrop-blur-xl dark:bg-[#09101f]/82 sm:px-7 lg:px-10"><div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3"><img src="/brand/arrow-blue.png" alt="" className="h-9 w-9 object-contain lg:hidden" /><div className="min-w-0"><p className="truncate text-sm font-extrabold">{displayName}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-400">ревизия {envelope.revision}</p></div></div>
        <div className="flex items-center gap-2"><button onClick={exportData} className="hidden rounded-xl border p-2.5 text-slate-500 transition hover:border-[#0056FF] hover:text-[#0056FF] sm:block" title="Скачать копию"><Download className="h-4 w-4" /></button><button onClick={() => importInput.current?.click()} className="hidden rounded-xl border p-2.5 text-slate-500 transition hover:border-[#0056FF] hover:text-[#0056FF] sm:block" title="Восстановить из копии"><Upload className="h-4 w-4" /></button><input ref={importInput} type="file" accept="application/json" className="hidden" onChange={(event) => event.target.files?.[0] && void importData(event.target.files[0])} /><button onClick={toggleTheme} className="rounded-xl border p-2.5 text-slate-500 transition hover:border-[#0056FF] hover:text-[#0056FF]" title="Сменить тему">{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button onClick={() => void save(message.includes("копия") ? "dashboard_restore" : "dashboard_update")} disabled={status === "saving"} className="flex items-center gap-2 rounded-xl bg-[#0056FF] px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-[#0056FF]/20 transition hover:bg-[#0049d9] disabled:opacity-60">{status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "saved" ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}{status === "saved" ? "Сохранено" : "Сохранить"}</button></div>
      </div>{(message || status === "error") && <p className={`mx-auto mt-2 max-w-[1400px] text-xs ${status === "error" ? "text-red-500" : "text-[#0056FF]"}`}>{message}</p>}</header>

      <main className="mx-auto max-w-[1400px] space-y-10 px-4 py-6 sm:px-7 lg:px-10 lg:py-10">
        <section id="overview" className="scroll-mt-24"><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#0056FF]">Личная система</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Вижу курс. Держу ритм.</h1></div><p className="max-w-md text-sm leading-6 text-slate-500 dark:text-slate-300">Не рейтинг и не контроль. Здесь видны ваши решения, действия и выводы.</p></div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[
            { label: "Годовая цель", value: draft.annualGoal.title || "Сформулировать", meta: `${draft.annualGoal.progress}% пути`, icon: Target },
            { label: "12 недель", value: draft.sprint.title, meta: `Неделя ${draft.sprint.weekNumber} из 12`, icon: CalendarRange },
            { label: "Эта неделя", value: draft.currentWeek.focus || "Выбрать фокус", meta: `${taskProgress}% задач`, icon: Flag },
            { label: "Сверка курса", value: draft.checkpoints[0] ? "Выполнена" : "Через 4 недели", meta: draft.checkpoints[0]?.note || "НОРД поможет свериться", icon: Compass },
          ].map((item) => { const Icon = item.icon; return <Card key={item.label} className="p-5"><div className="mb-5 flex items-center justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0056FF]/10 text-[#0056FF]"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-300" /></div><p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-400">{item.label}</p><p className="mt-2 line-clamp-2 min-h-11 text-base font-extrabold">{item.value}</p><p className="mt-3 truncate text-xs text-slate-500 dark:text-slate-400">{item.meta}</p></Card>; })}</div>
        </section>

        <section id="beacon" className="scroll-mt-24 overflow-hidden rounded-[30px] border bg-[#0F172A] text-white shadow-[0_24px_80px_rgba(15,23,42,.22)]"><div className="relative min-h-[520px] overflow-hidden lg:min-h-[570px]"><img src="/images/lighthouse-hero.png" alt="Маяк на морском берегу в синем свете" className="absolute inset-0 h-full w-full object-cover object-center" /><div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,15,31,.98)_0%,rgba(7,15,31,.88)_43%,rgba(7,15,31,.18)_78%)]" /><div className="relative z-10 flex min-h-[520px] max-w-3xl flex-col justify-center p-6 sm:p-10 lg:min-h-[570px] lg:p-14"><div className="mb-7 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0056FF]"><Compass className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.18em] text-blue-300">Направление на {draft.beacon.horizon}</p><p className="text-sm font-bold text-white/70">Сверка с НОРДом каждые 4 недели</p></div></div><h2 className="text-4xl font-extrabold tracking-tight sm:text-6xl">МОЙ МАЯК</h2><input value={draft.beacon.title} onChange={(event) => update((state) => { state.beacon.title = event.target.value; return state; })} className="mt-4 max-w-xl border-b border-white/25 bg-transparent pb-3 text-xl font-extrabold outline-none placeholder:text-white/35 focus:border-[#2277FF] sm:text-2xl" placeholder="Как называется ваш курс?" /><div className="mt-8 grid max-w-2xl gap-4 md:grid-cols-2"><label className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[.13em] text-blue-200">К чему иду</span><textarea rows={5} value={draft.beacon.desiredFuture} onChange={(event) => update((state) => { state.beacon.desiredFuture = event.target.value; return state; })} className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-white/35" placeholder="Образ жизни, деятельности, состояния и окружения…" /></label><label className="rounded-2xl border border-white/15 bg-white/5 p-4 backdrop-blur"><span className="mb-2 block text-[10px] font-extrabold uppercase tracking-[.13em] text-slate-300">Чего не хочу — факультативно</span><textarea rows={5} value={draft.beacon.undesiredFuture} onChange={(event) => update((state) => { state.beacon.undesiredFuture = event.target.value; return state; })} className="w-full resize-none bg-transparent text-sm leading-6 outline-none placeholder:text-white/30" placeholder="Образ нежелательного будущего, если он помогает выбрать курс…" /></label></div></div></div></section>

        <section id="passport" className="scroll-mt-24"><SectionTitle eyebrow="НОРД · стратегический компас" title="Паспорт роста" description="Фиксирует исходную точку, сильные стороны, ограничения, ценности и образ жизни на горизонте 3–5 лет." /><div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><Card className="p-6 sm:p-8"><FieldLabel>Точка А — что есть сейчас</FieldLabel><TextArea value={draft.passport.pointA} onChange={(value) => update((state) => { state.passport.pointA = value; return state; })} placeholder="Факты, ресурсы, ограничения и уже работающие практики…" rows={8} /><div className="mt-6"><FieldLabel>Видение на 3–5 лет</FieldLabel><TextArea value={draft.passport.threeYearVision} onChange={(value) => update((state) => { state.passport.threeYearVision = value; return state; })} placeholder="Не жесткий прогноз, а компас для решений…" rows={7} /></div></Card><div className="grid gap-5">{([['Сильные стороны', 'Что уже помогает двигаться', 'strengths'], ['Ограничения', 'Что важно учитывать без самообвинения', 'constraints'], ['Ценности', 'Что нельзя потерять по дороге', 'values']] as const).map(([title, placeholder, key]) => <Card key={key} className="p-6"><FieldLabel>{title}</FieldLabel><TextArea value={draft.passport[key].join("\n")} onChange={(value) => update((state) => { state.passport[key] = value.split("\n").map((item) => item.trim()).filter(Boolean); return state; })} placeholder={`${placeholder}. По одному пункту на строку.`} rows={4} /></Card>)}</div></div></section>

        <section id="sprint" className="scroll-mt-24"><SectionTitle eyebrow="ГР - РИТМ" title="Годовая цель и 12 недель" description="Реалистичная годовая цель задает направление. Спринт превращает ее в короткий цикл действий с разной допустимой нагрузкой." /><div className="grid gap-5 xl:grid-cols-2">
          <Card className="p-6 sm:p-8"><div className="mb-5 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0056FF]/10 text-[#0056FF]"><Target className="h-5 w-5" /></span><span className="text-2xl font-extrabold text-[#0056FF]">{draft.annualGoal.progress}%</span></div><FieldLabel>Годовая цель</FieldLabel><TextInput value={draft.annualGoal.title} onChange={(value) => update((state) => { state.annualGoal.title = value; return state; })} placeholder="Один ясный результат года" /><div className="mt-4"><FieldLabel>Как пойму, что получилось</FieldLabel><TextArea value={draft.annualGoal.successMetric} onChange={(value) => update((state) => { state.annualGoal.successMetric = value; return state; })} placeholder="Проверяемый критерий результата" rows={3} /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><FieldLabel>Срок</FieldLabel><TextInput type="date" value={draft.annualGoal.targetDate} onChange={(value) => update((state) => { state.annualGoal.targetDate = value; return state; })} placeholder="" /></div><div><FieldLabel>Прогресс</FieldLabel><input type="range" min="0" max="100" value={draft.annualGoal.progress} onChange={(event) => update((state) => { state.annualGoal.progress = Number(event.target.value); return state; })} className="mt-3 w-full accent-[#0056FF]" /></div></div></Card>
          <Card className="p-6 sm:p-8"><div className="mb-5 flex items-center justify-between"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0F172A] text-white dark:bg-[#2277FF]"><CalendarRange className="h-5 w-5" /></span><span className="rounded-full bg-[#0056FF]/10 px-3 py-1 text-xs font-extrabold text-[#0056FF]">НЕДЕЛЯ {draft.sprint.weekNumber}/12</span></div><FieldLabel>12-недельный результат</FieldLabel><TextInput value={draft.sprint.title} onChange={(value) => update((state) => { state.sprint.title = value; return state; })} placeholder="Название цикла" /><div className="mt-4"><TextArea value={draft.sprint.outcome} onChange={(value) => update((state) => { state.sprint.outcome = value; return state; })} placeholder="Какой конкретный результат должен появиться к концу 12 недель?" rows={4} /></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><FieldLabel>Начало</FieldLabel><TextInput type="date" value={draft.sprint.startDate} onChange={(value) => update((state) => { state.sprint.startDate = value; return state; })} placeholder="" /></div><div><FieldLabel>Финиш</FieldLabel><TextInput type="date" value={draft.sprint.endDate} onChange={(value) => update((state) => { state.sprint.endDate = value; return state; })} placeholder="" /></div><div><FieldLabel>Неделя</FieldLabel><input type="number" min="1" max="12" value={draft.sprint.weekNumber} onChange={(event) => update((state) => { state.sprint.weekNumber = Math.min(12, Math.max(1, Number(event.target.value))); return state; })} className="w-full rounded-2xl border bg-white/80 px-4 py-3 text-sm outline-none dark:bg-white/5" /></div></div></Card>
        </div>
        <Card className="mt-5 p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#0056FF]">План недели</p><h3 className="mt-2 text-xl font-extrabold">Что действительно двигает к результату</h3></div><select value={draft.currentWeek.capacity} onChange={(event) => update((state) => { state.currentWeek.capacity = event.target.value as GrowthState["currentWeek"]["capacity"]; return state; })} className="rounded-xl border bg-white px-4 py-2.5 text-xs font-bold outline-none dark:bg-[#111b31]"><option value="light">Щадящая нагрузка</option><option value="normal">Обычная нагрузка</option><option value="intensive">Интенсивная нагрузка</option></select></div><div className="mt-6"><FieldLabel>Главный фокус</FieldLabel><TextInput value={draft.currentWeek.focus} onChange={(value) => update((state) => { state.currentWeek.focus = value; return state; })} placeholder="Одна главная мысль недели" /></div><div className="mt-6 space-y-2">{draft.currentWeek.tasks.map((task) => <label key={task.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border bg-slate-50/70 px-4 py-3 transition hover:border-[#0056FF]/40 dark:bg-white/5"><input type="checkbox" checked={task.done} onChange={(event) => update((state) => { const current = state.currentWeek.tasks.find((item) => item.id === task.id); if (current) current.done = event.target.checked; return state; })} className="h-5 w-5 accent-[#0056FF]" /><span className={`flex-1 text-sm font-semibold ${task.done ? "text-slate-400 line-through" : ""}`}>{task.title}</span><span className="text-[9px] font-extrabold uppercase tracking-[.1em] text-slate-400">{task.priority === "main" ? "главное" : "поддержка"}</span></label>)}</div><div className="mt-3 flex gap-2"><input value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTask(); }} className="min-w-0 flex-1 rounded-xl border bg-transparent px-4 py-3 text-sm outline-none focus:border-[#0056FF]" placeholder="Добавить проверяемое действие" /><button onClick={addTask} className="grid h-12 w-12 place-items-center rounded-xl bg-[#0F172A] text-white dark:bg-[#2277FF]"><Plus className="h-5 w-5" /></button></div></Card></section>

        <section id="reports" className="scroll-mt-24"><SectionTitle eyebrow="Цикл действие → анализ → улучшение" title="Отчеты и рефлексия" description="Не оценка личности, а факты недели: что сделано, чему это научило и что изменить в следующем цикле." /><div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-6"><p className="text-[11px] font-extrabold uppercase tracking-[.13em] text-[#0056FF]">Новый отчет</p><div className="mt-5 space-y-4"><div><FieldLabel>Что сделано</FieldLabel><TextArea value="" onChange={() => {}} placeholder="Отчет удобно добавить в разговоре с РИТМОМ — он сохранит его через личный плагин." rows={4} readOnly /></div><div className="rounded-2xl bg-[#0056FF]/8 p-4 text-xs leading-5 text-slate-600 dark:text-slate-300"><Sparkles className="mb-2 h-4 w-4 text-[#0056FF]" />В MCP уже есть инструмент <b>submit_week_report</b>. Дашборд обновится после сохранения специалистом и перезагрузки страницы.</div></div></Card><div className="space-y-3">{draft.reports.length ? draft.reports.slice(0, 6).map((report) => <Card key={report.id} className="p-5"><div className="flex items-center justify-between"><span className="rounded-full bg-[#0056FF]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-[#0056FF]">Неделя {report.week}</span><span className="text-[10px] text-slate-400">{new Date(report.createdAt).toLocaleDateString("ru-RU")}</span></div><p className="mt-4 text-sm font-extrabold">{report.completed}</p><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-300">Вывод: {report.insight}</p><p className="mt-2 flex items-start gap-2 text-xs font-semibold text-[#0056FF]"><ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />{report.nextChange}</p></Card>) : <Card className="grid min-h-[300px] place-items-center p-8 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5"><Flag className="h-6 w-6" /></span><p className="mt-4 font-extrabold">Пока нет отчетов</p><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Первый отчет появится здесь после недельной рефлексии с РИТМОМ.</p></div></Card>}</div></div></section>

        <section id="wheel" className="scroll-mt-24 pb-10"><SectionTitle eyebrow="Диагностика без гонки" title="Колесо жизни" description="Снимок текущего баланса помогает не выбирать цель в отрыве от всей жизни. Шкала — личная, сравнивать ее с другими не нужно." /><Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><WheelChart values={draft.wheel} /><div className="grid gap-4 sm:grid-cols-2">{draft.wheel.map((item, index) => <label key={item.area} className="rounded-2xl border bg-slate-50/60 p-4 dark:bg-white/5"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-extrabold">{item.area}</span><span className="text-lg font-extrabold text-[#0056FF]">{item.score}</span></div><input type="range" min="0" max="10" step="1" value={item.score} onChange={(event) => update((state) => { state.wheel[index].score = Number(event.target.value); return state; })} className="w-full accent-[#0056FF]" /></label>)}</div></Card></section>

        <section className="mb-8 rounded-3xl border bg-white p-6 dark:bg-[#111b31]"><p className="text-xs font-extrabold text-[#0056FF]">ГР - НОРД · Память продолжения</p><h3 className="mt-3 font-extrabold">{draft.nordMemory.stage}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{draft.nordMemory.summary || "После первого сохранения НОРДом здесь появится краткий итог работы."}</p>{draft.nordMemory.nextStep && <p className="mt-3 text-sm font-semibold">Следующий шаг: {draft.nordMemory.nextStep}</p>}{draft.nordMemory.openQuestions.length > 0 && <ul className="mt-3 list-inside list-disc text-sm">{draft.nordMemory.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul>}</section>
        <footer className="flex flex-col justify-between gap-3 border-t py-8 text-[11px] text-slate-400 sm:flex-row"><span>ГРУППА РОСТА · личные данные остаются в вашем приватном Site</span><span className="flex items-center gap-2"><RotateCcw className="h-3.5 w-3.5" />Обновления кода не перезаписывают D1-хранилище</span></footer>
      </main>
    </div>
  </div>;
}
