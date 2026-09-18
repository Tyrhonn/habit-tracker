"use client";

import Image from "next/image";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Gift,
  Grid3X3,
  ImagePlus,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Habit = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  active_days: number[];
  start_date: string;
  end_date: string | null;
  sort_order: number;
  is_archived: boolean;
};

type HabitLog = {
  id: string;
  habit_id: string;
  log_date: string;
  completed: boolean;
  note: string | null;
};

type Reward = {
  id: string;
  title: string;
  description: string | null;
  image_path: string | null;
  target_value: number;
  unlocked_at: string | null;
  signedUrl?: string;
};

type HabitDraft = {
  name: string;
  emoji: string;
  color: string;
  activeDays: number[];
};

type WebMcpContext = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ) => void | Promise<void>;
};

declare global {
  interface Document {
    readonly modelContext?: WebMcpContext;
  }
}

const DAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const COLORS = ["#316342", "#0f766e", "#2563eb", "#7c3aed", "#d97706", "#dc2626"];
const EMOJIS = ["🌿", "💧", "📚", "🏃", "🧘", "🌙", "✍️", "💻"];
const EMPTY_DRAFT: HabitDraft = {
  name: "",
  emoji: "🌿",
  color: COLORS[0],
  activeDays: [0, 1, 2, 3, 4, 5, 6],
};

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function monthBounds(date: Date) {
  return {
    first: localDate(new Date(date.getFullYear(), date.getMonth(), 1)),
    last: localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
  };
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(date);
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function activeDates(habit: Habit, month: Date) {
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const result: string[] = [];
  for (let day = 1; day <= count; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day);
    const value = localDate(date);
    if (
      habit.active_days.includes(date.getDay()) &&
      value >= habit.start_date &&
      (!habit.end_date || value <= habit.end_date)
    ) result.push(value);
  }
  return result;
}

export function HabitDashboard({ userEmail }: { userEmail: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [today, setToday] = useState(() => localDate(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => localDate(new Date()));
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [habitPanel, setHabitPanel] = useState(false);
  const [rewardPanel, setRewardPanel] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const [draft, setDraft] = useState<HabitDraft>(EMPTY_DRAFT);
  const [rewardTitle, setRewardTitle] = useState("");
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardTarget, setRewardTarget] = useState(80);
  const [rewardImage, setRewardImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toast = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3000);
  }, []);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    const { first, last } = monthBounds(viewMonth);
    const [habitResult, logResult] = await Promise.all([
      supabase
        .from("habits")
        .select("id,name,emoji,color,active_days,start_date,end_date,sort_order,is_archived")
        .eq("is_archived", false)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("habit_logs")
        .select("id,habit_id,log_date,completed,note")
        .gte("log_date", first)
        .lte("log_date", last),
    ]);
    if (habitResult.error) throw habitResult.error;
    if (logResult.error) throw logResult.error;
    setHabits((habitResult.data ?? []) as Habit[]);
    setLogs((logResult.data ?? []) as HabitLog[]);
    setLoading(false);
  }, [supabase, viewMonth]);

  const loadRewards = useCallback(async () => {
    const { data, error } = await supabase
      .from("rewards")
      .select("id,title,description,image_path,target_value,unlocked_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    const withUrls = await Promise.all(
      ((data ?? []) as Reward[]).map(async (reward) => {
        if (!reward.image_path) return reward;
        const { data: signed } = await supabase.storage
          .from("reward-images")
          .createSignedUrl(reward.image_path, 3600);
        return { ...reward, signedUrl: signed?.signedUrl };
      }),
    );
    setRewards(withUrls);
  }, [supabase]);

  useEffect(() => {
    loadMonth().catch((error) => {
      console.error(error);
      setLoading(false);
      toast("Không thể tải dữ liệu. Hãy làm mới trang.");
    });
  }, [loadMonth, toast]);

  useEffect(() => {
    loadRewards().catch(console.error);
  }, [loadRewards]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = context.registerTool(
      {
        name: "create_habit",
        title: "Tạo thói quen",
        description: "Tạo một thói quen mới trong HabitGrid và cập nhật bảng theo dõi đang hiển thị.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            emoji: { type: "string" },
            activeDays: {
              type: "array",
              items: { type: "integer", minimum: 0, maximum: 6 },
              minItems: 1,
              uniqueItems: true,
            },
          },
          required: ["name"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        async execute(input) {
          const value = input as { name?: unknown; emoji?: unknown; activeDays?: unknown };
          if (typeof value.name !== "string" || !value.name.trim()) throw new Error("Tên thói quen không hợp lệ.");
          const days = Array.isArray(value.activeDays) ? value.activeDays : [0, 1, 2, 3, 4, 5, 6];
          if (!days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error("Ngày lặp lại không hợp lệ.");
          const { data, error } = await supabase
            .from("habits")
            .insert({
              name: value.name.trim(),
              emoji: typeof value.emoji === "string" ? value.emoji : "🌿",
              color: COLORS[0],
              active_days: days,
              start_date: today,
            })
            .select("id,name")
            .single();
          if (error) throw new Error(error.message);
          await loadMonth();
          return { id: data.id, name: data.name, status: "created" };
        },
      },
      { signal: lifecycle.signal },
    );
    void Promise.resolve(register).catch(console.error);
    return () => lifecycle.abort();
  }, [loadMonth, supabase, today]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = localDate(new Date());
      setToday((current) => {
        if (current !== next) setSelectedDate(next);
        return next;
      });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const logMap = useMemo(
    () => new Map(logs.map((log) => [`${log.habit_id}:${log.log_date}`, log])),
    [logs],
  );
  const selectedObject = parseDate(selectedDate);
  const selectedHabits = habits.filter(
    (habit) =>
      habit.active_days.includes(selectedObject.getDay()) &&
      selectedDate >= habit.start_date &&
      (!habit.end_date || selectedDate <= habit.end_date),
  );
  const selectedDone = selectedHabits.filter(
    (habit) => logMap.get(`${habit.id}:${selectedDate}`)?.completed,
  ).length;
  const selectedPercent = selectedHabits.length
    ? Math.round((selectedDone / selectedHabits.length) * 100)
    : 0;

  const monthStats = useMemo(() => {
    let planned = 0;
    let completed = 0;
    habits.forEach((habit) => {
      const dates = activeDates(habit, viewMonth).filter((date) => date <= today);
      planned += dates.length;
      completed += dates.filter((date) => logMap.get(`${habit.id}:${date}`)?.completed).length;
    });
    return { completed, percent: planned ? Math.round((completed / planned) * 100) : 0 };
  }, [habits, logMap, today, viewMonth]);

  const streak = useMemo(() => {
    let value = 0;
    const cursor = parseDate(today);
    for (let i = 0; i < 366; i += 1) {
      const date = localDate(cursor);
      const daily = habits.filter(
        (habit) =>
          habit.active_days.includes(cursor.getDay()) &&
          date >= habit.start_date &&
          (!habit.end_date || date <= habit.end_date),
      );
      if (!daily.length) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      if (!daily.every((habit) => logMap.get(`${habit.id}:${date}`)?.completed)) break;
      value += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return value;
  }, [habits, logMap, today]);

  async function toggleHabit(habit: Habit, date: string) {
    const key = `${habit.id}:${date}`;
    const completed = !logMap.get(key)?.completed;
    setSavingId(key);
    const { data, error } = await supabase
      .from("habit_logs")
      .upsert(
        {
          habit_id: habit.id,
          log_date: date,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        },
        { onConflict: "habit_id,log_date" },
      )
      .select("id,habit_id,log_date,completed,note")
      .single();
    setSavingId(null);
    if (error) return toast("Chưa lưu được. Hãy thử lại.");
    setLogs((current) => [
      ...current.filter((log) => !(log.habit_id === habit.id && log.log_date === date)),
      data as HabitLog,
    ]);
  }

  function newHabit() {
    setEditing(null);
    setDraft(EMPTY_DRAFT);
    setHabitPanel(true);
  }

  function editHabit(habit: Habit) {
    setEditing(habit);
    setDraft({
      name: habit.name,
      emoji: habit.emoji ?? "🌿",
      color: habit.color ?? COLORS[0],
      activeDays: habit.active_days,
    });
    setHabitPanel(true);
  }

  async function saveHabit(event: FormEvent) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.activeDays.length) return;
    setSubmitting(true);
    const payload = {
      name: draft.name.trim(),
      emoji: draft.emoji,
      color: draft.color,
      active_days: [...draft.activeDays].sort((a, b) => a - b),
    };
    const result = editing
      ? await supabase.from("habits").update(payload).eq("id", editing.id)
      : await supabase.from("habits").insert({ ...payload, start_date: today });
    setSubmitting(false);
    if (result.error) return toast("Không thể lưu thói quen.");
    setHabitPanel(false);
    await loadMonth();
    toast(editing ? "Đã cập nhật thói quen." : "Đã thêm thói quen mới.");
  }

  async function archiveHabit(habit: Habit) {
    const { error } = await supabase
      .from("habits")
      .update({ is_archived: true, end_date: today })
      .eq("id", habit.id);
    if (error) return toast("Không thể lưu trữ thói quen.");
    setHabitPanel(false);
    await loadMonth();
    toast("Đã đưa thói quen vào lưu trữ.");
  }

  async function saveReward(event: FormEvent) {
    event.preventDefault();
    if (!rewardTitle.trim()) return;
    setSubmitting(true);
    let imagePath: string | null = null;
    if (rewardImage) {
      if (rewardImage.size > 5 * 1024 * 1024) {
        setSubmitting(false);
        return toast("Ảnh cần nhỏ hơn 5 MB.");
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const ext = rewardImage.name.split(".").pop() ?? "jpg";
      imagePath = `${data.user.id}/${crypto.randomUUID()}.${ext}`;
      const uploaded = await supabase.storage
        .from("reward-images")
        .upload(imagePath, rewardImage, { contentType: rewardImage.type });
      if (uploaded.error) {
        setSubmitting(false);
        return toast("Không thể tải ảnh lên.");
      }
    }
    const { error } = await supabase.from("rewards").insert({
      title: rewardTitle.trim(),
      description: rewardDescription.trim() || null,
      image_path: imagePath,
      target_type: "completion",
      target_value: rewardTarget,
    });
    setSubmitting(false);
    if (error) return toast("Không thể lưu phần thưởng.");
    setRewardTitle("");
    setRewardDescription("");
    setRewardTarget(80);
    setRewardImage(null);
    setRewardPanel(false);
    await loadRewards();
    toast("Đã thêm phần thưởng mới.");
  }

  async function deleteReward(reward: Reward) {
    if (reward.image_path) await supabase.storage.from("reward-images").remove([reward.image_path]);
    const { error } = await supabase.from("rewards").delete().eq("id", reward.id);
    if (error) return toast("Không thể xóa phần thưởng.");
    await loadRewards();
    toast("Đã xóa phần thưởng.");
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  function changeMonth(offset: number) {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + offset, 1);
    setViewMonth(next);
    const now = new Date();
    setSelectedDate(
      next.getFullYear() === now.getFullYear() && next.getMonth() === now.getMonth()
        ? today
        : localDate(next),
    );
  }

  const days = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Grid3X3 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold tracking-tight">HabitGrid</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Nhật ký thói quen của riêng bạn</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-52 truncate rounded-full bg-muted px-3 py-1.5 text-sm text-muted-foreground md:block">
              {userEmail}
            </span>
            <Button className="rounded-xl" onClick={newHabit}>
              <Plus /><span className="hidden sm:inline">Thêm thói quen</span>
            </Button>
            <Button aria-label="Đăng xuất" variant="ghost" size="icon" onClick={logout}><LogOut /></Button>
          </div>
        </div>
      </header>

      <div className="dot-grid mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <section className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="soft-shadow rounded-3xl border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">Hôm nay</span>
                  <span className="text-sm capitalize text-muted-foreground">{dateLabel(parseDate(today))}</span>
                </div>
                <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Từng ô nhỏ, một ngày tốt hơn.</h1>
                <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                  Chọn một ngày, đánh dấu việc đã làm và để tiến độ tự cộng dồn.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Metric icon={Target} label="Tháng này" value={`${monthStats.percent}%`} />
                <Metric icon={Flame} label="Chuỗi ngày" value={`${streak}`} tone="orange" />
                <Metric icon={Check} label="Đã xong" value={`${monthStats.completed}`} tone="blue" />
              </div>
            </div>
          </div>
          <div className="soft-shadow flex min-w-60 items-center justify-between rounded-3xl border bg-primary p-5 text-primary-foreground">
            <div>
              <p className="text-sm opacity-75">Tiến độ ngày đã chọn</p>
              <p className="mt-1 text-4xl font-bold">{selectedPercent}%</p>
              <p className="mt-1 text-sm opacity-75">{selectedDone}/{selectedHabits.length} thói quen</p>
            </div>
            <ProgressRing value={selectedPercent} />
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <section className="soft-shadow rounded-3xl border bg-card p-5">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">Ngày đang xem</p>
                  <h2 className="mt-1 text-xl font-bold capitalize">{dateLabel(selectedObject)}</h2>
                </div>
                {selectedDate !== today && (
                  <button
                    className="rounded-full bg-muted px-3 py-1 text-sm font-medium hover:bg-accent"
                    onClick={() => {
                      const now = new Date();
                      setSelectedDate(today);
                      setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                    }}
                  >Hôm nay</button>
                )}
              </div>
              <div className="space-y-2">
                {loading ? <Loading text="Đang tải dữ liệu…" /> : selectedHabits.length ? (
                  selectedHabits.map((habit) => {
                    const key = `${habit.id}:${selectedDate}`;
                    const done = Boolean(logMap.get(key)?.completed);
                    return (
                      <div key={habit.id} className={cn("group flex items-center gap-3 rounded-2xl border p-3", done && "border-primary/20 bg-accent/70")}>
                        <button
                          aria-label={`${done ? "Bỏ đánh dấu" : "Đánh dấu"} ${habit.name}`}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2"
                          style={{ borderColor: habit.color ?? COLORS[0], backgroundColor: done ? habit.color ?? COLORS[0] : "transparent" }}
                          onClick={() => toggleHabit(habit, selectedDate)}
                          disabled={savingId === key}
                        >
                          {savingId === key ? <Loader2 className="h-4 w-4 animate-spin" /> : done ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                        </button>
                        <span className="text-xl">{habit.emoji}</span>
                        <span className={cn("min-w-0 flex-1 font-medium", done && "text-muted-foreground line-through")}>{habit.name}</span>
                        <button aria-label={`Sửa ${habit.name}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-background" onClick={() => editHabit(habit)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState icon={Sparkles} title="Ngày này đang trống" description="Thêm thói quen đầu tiên để bắt đầu theo dõi." action="Thêm thói quen" onAction={newHabit} />
                )}
              </div>
            </section>

            <section className="soft-shadow rounded-3xl border bg-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-primary">Góc phần thưởng</p><h2 className="mt-1 text-xl font-bold">Điều mình mong đợi</h2></div>
                <Button aria-label="Thêm phần thưởng" variant="outline" size="icon" className="rounded-xl" onClick={() => setRewardPanel(true)}><Plus /></Button>
              </div>
              {rewards.length ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {rewards.slice(0, 3).map((reward) => (
                    <div key={reward.id} className="group overflow-hidden rounded-2xl border bg-muted">
                      {reward.signedUrl ? (
                        <div className="relative h-32 w-full"><Image src={reward.signedUrl} alt={reward.title} fill unoptimized className="object-cover" /></div>
                      ) : (
                        <div className="grid h-24 place-items-center bg-gradient-to-br from-secondary to-accent"><Gift className="h-9 w-9 text-primary" /></div>
                      )}
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div><p className="font-semibold">{reward.title}</p><p className="text-sm text-muted-foreground">Mở khóa ở {reward.target_value}% tháng</p></div>
                          <button aria-label={`Xóa ${reward.title}`} className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-destructive" onClick={() => deleteReward(reward)}><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (monthStats.percent / reward.target_value) * 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={Gift} title="Thêm một điều đáng mong chờ" description="Một món quà, chuyến đi hoặc khoảnh khắc bạn muốn tự thưởng." action="Thêm phần thưởng" onAction={() => setRewardPanel(true)} />
              )}
            </section>
          </aside>

          <MonthGrid
            habits={habits}
            logs={logs}
            loading={loading}
            today={today}
            selectedDate={selectedDate}
            viewMonth={viewMonth}
            days={days}
            savingId={savingId}
            onSelectDate={setSelectedDate}
            onToggle={toggleHabit}
            onEdit={editHabit}
            onChangeMonth={changeMonth}
            onCurrentMonth={() => {
              const now = new Date();
              setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
              setSelectedDate(today);
            }}
            onNew={newHabit}
          />
        </div>
      </div>

      {habitPanel && (
        <Panel title={editing ? "Sửa thói quen" : "Thêm thói quen"} onClose={() => setHabitPanel(false)}>
          <HabitForm
            draft={draft}
            editing={editing}
            submitting={submitting}
            onDraft={setDraft}
            onSubmit={saveHabit}
            onArchive={() => editing && archiveHabit(editing)}
          />
        </Panel>
      )}
      {rewardPanel && (
        <Panel title="Thêm phần thưởng" onClose={() => setRewardPanel(false)}>
          <RewardForm
            title={rewardTitle}
            description={rewardDescription}
            target={rewardTarget}
            image={rewardImage}
            submitting={submitting}
            onTitle={setRewardTitle}
            onDescription={setRewardDescription}
            onTarget={setRewardTarget}
            onImage={setRewardImage}
            onSubmit={saveReward}
          />
        </Panel>
      )}
      {notice && <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-xl">{notice}</div>}
    </main>
  );
}

function MonthGrid({
  habits,
  logs,
  loading,
  today,
  selectedDate,
  viewMonth,
  days,
  savingId,
  onSelectDate,
  onToggle,
  onEdit,
  onChangeMonth,
  onCurrentMonth,
  onNew,
}: {
  habits: Habit[];
  logs: HabitLog[];
  loading: boolean;
  today: string;
  selectedDate: string;
  viewMonth: Date;
  days: number;
  savingId: string | null;
  onSelectDate: (date: string) => void;
  onToggle: (habit: Habit, date: string) => void;
  onEdit: (habit: Habit) => void;
  onChangeMonth: (offset: number) => void;
  onCurrentMonth: () => void;
  onNew: () => void;
}) {
  const logMap = new Map(logs.map((log) => [`${log.habit_id}:${log.log_date}`, log]));
  return (
    <section className="soft-shadow min-w-0 rounded-3xl border bg-card p-4 sm:p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><CalendarDays className="h-4 w-4" /> Bảng theo dõi tháng</div>
          <h2 className="mt-1 text-2xl font-bold capitalize">{monthLabel(viewMonth)}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button aria-label="Tháng trước" variant="outline" size="icon" className="rounded-xl" onClick={() => onChangeMonth(-1)}><ChevronLeft /></Button>
          <Button variant="outline" className="rounded-xl" onClick={onCurrentMonth}>Tháng này</Button>
          <Button aria-label="Tháng sau" variant="outline" size="icon" className="rounded-xl" onClick={() => onChangeMonth(1)}><ChevronRight /></Button>
        </div>
      </div>
      {loading ? (
        <div className="grid min-h-[420px] place-items-center rounded-2xl bg-muted/50"><Loading text="Đang dựng bảng tháng…" /></div>
      ) : habits.length ? (
        <div className="scrollbar-thin overflow-x-auto pb-2">
          <div className="min-w-[980px]">
            <div
              className="grid items-center gap-1 border-b pb-2 text-center text-xs font-semibold text-muted-foreground"
              style={{ gridTemplateColumns: `220px repeat(${days}, minmax(24px, 1fr)) 72px` }}
            >
              <div className="px-2 text-left">Thói quen</div>
              {Array.from({ length: days }, (_, index) => {
                const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index + 1);
                const value = localDate(date);
                return (
                  <button
                    key={value}
                    className={cn(
                      "rounded-lg py-1.5 hover:bg-muted",
                      selectedDate === value && "bg-primary text-primary-foreground hover:bg-primary",
                      today === value && selectedDate !== value && "bg-accent text-accent-foreground",
                    )}
                    onClick={() => onSelectDate(value)}
                  >
                    <span className="block text-[10px] font-medium opacity-70">{DAY_NAMES[date.getDay()]}</span>{index + 1}
                  </button>
                );
              })}
              <div>Tỷ lệ</div>
            </div>
            <div className="divide-y">
              {habits.map((habit) => {
                const dates = activeDates(habit, viewMonth);
                const eligible = dates.filter((date) => date <= today);
                const completed = eligible.filter((date) => logMap.get(`${habit.id}:${date}`)?.completed).length;
                const percent = eligible.length ? Math.round((completed / eligible.length) * 100) : 0;
                return (
                  <div
                    key={habit.id}
                    className="grid items-center gap-1 py-3"
                    style={{ gridTemplateColumns: `220px repeat(${days}, minmax(24px, 1fr)) 72px` }}
                  >
                    <button className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1 text-left hover:bg-muted" onClick={() => onEdit(habit)}>
                      <span className="text-lg">{habit.emoji}</span><span className="truncate text-sm font-semibold">{habit.name}</span><Pencil className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {Array.from({ length: days }, (_, index) => {
                      const date = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index + 1);
                      const value = localDate(date);
                      const active = dates.includes(value);
                      const done = Boolean(logMap.get(`${habit.id}:${value}`)?.completed);
                      const key = `${habit.id}:${value}`;
                      return (
                        <button
                          key={value}
                          aria-label={`${habit.name}, ngày ${index + 1}: ${done ? "đã hoàn thành" : "chưa hoàn thành"}`}
                          disabled={!active || savingId === key}
                          onClick={() => onToggle(habit, value)}
                          className={cn("mx-auto grid h-6 w-6 place-items-center rounded-md border text-white", !active && "border-transparent bg-muted/45", active && !done && "hover:scale-110 hover:bg-muted")}
                          style={active ? { borderColor: `${habit.color ?? COLORS[0]}66`, backgroundColor: done ? habit.color ?? COLORS[0] : undefined } : undefined}
                        >
                          {savingId === key ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                        </button>
                      );
                    })}
                    <div className="text-center text-sm font-bold" style={{ color: habit.color ?? COLORS[0] }}>{percent}%</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[420px] place-items-center rounded-2xl border border-dashed bg-muted/35 p-6">
          <EmptyState icon={Target} title="Bảng tháng đang chờ bạn" description="Tạo thói quen đầu tiên rồi đánh dấu mỗi ngày để xem tiến độ đầy dần." action="Tạo thói quen đầu tiên" onAction={onNew} />
        </div>
      )}
    </section>
  );
}

function HabitForm({
  draft,
  editing,
  submitting,
  onDraft,
  onSubmit,
  onArchive,
}: {
  draft: HabitDraft;
  editing: Habit | null;
  submitting: boolean;
  onDraft: (draft: HabitDraft) => void;
  onSubmit: (event: FormEvent) => void;
  onArchive: () => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="habit-name">Tên thói quen</label>
        <Input id="habit-name" autoFocus placeholder="Ví dụ: Đọc 10 trang sách" value={draft.name} onChange={(event) => onDraft({ ...draft, name: event.target.value })} className="h-11 rounded-xl" />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Biểu tượng</p>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((emoji) => (
            <button type="button" key={emoji} className={cn("grid h-11 w-11 place-items-center rounded-xl border text-xl hover:bg-muted", draft.emoji === emoji && "border-primary bg-accent")} onClick={() => onDraft({ ...draft, emoji })}>{emoji}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Màu đánh dấu</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button type="button" key={color} aria-label={`Chọn màu ${color}`} className={cn("grid h-9 w-9 place-items-center rounded-full border-4 border-background shadow-sm ring-offset-2", draft.color === color && "ring-2 ring-primary")} style={{ backgroundColor: color }} onClick={() => onDraft({ ...draft, color })}>
              {draft.color === color && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Lặp lại vào</p>
        <div className="grid grid-cols-7 gap-1.5">
          {DAY_NAMES.map((day, index) => {
            const active = draft.activeDays.includes(index);
            return (
              <button
                type="button"
                key={day}
                className={cn("rounded-xl border py-2 text-sm font-semibold", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
                onClick={() => onDraft({ ...draft, activeDays: active ? draft.activeDays.filter((value) => value !== index) : [...draft.activeDays, index] })}
              >{day}</button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        {editing ? <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={onArchive}><Archive /> Lưu trữ</Button> : <span />}
        <Button type="submit" className="rounded-xl" disabled={submitting || !draft.name.trim() || !draft.activeDays.length}>
          {submitting && <Loader2 className="animate-spin" />}{editing ? "Lưu thay đổi" : "Thêm thói quen"}
        </Button>
      </div>
    </form>
  );
}

function RewardForm({
  title,
  description,
  target,
  image,
  submitting,
  onTitle,
  onDescription,
  onTarget,
  onImage,
  onSubmit,
}: {
  title: string;
  description: string;
  target: number;
  image: File | null;
  submitting: boolean;
  onTitle: (value: string) => void;
  onDescription: (value: string) => void;
  onTarget: (value: number) => void;
  onImage: (file: File | null) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div><label className="mb-2 block text-sm font-semibold" htmlFor="reward-title">Tên phần thưởng</label><Input id="reward-title" autoFocus placeholder="Ví dụ: Một chuyến đi Đà Lạt" value={title} onChange={(event) => onTitle(event.target.value)} className="h-11 rounded-xl" /></div>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="reward-description">Ghi chú</label>
        <textarea id="reward-description" placeholder="Vì sao phần thưởng này quan trọng với bạn?" value={description} onChange={(event) => onDescription(event.target.value)} className="min-h-24 w-full resize-none rounded-xl border bg-background p-3 text-base outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="reward-target">Mở khóa khi đạt {target}% trong tháng</label>
        <input id="reward-target" type="range" min="20" max="100" step="5" value={target} onChange={(event) => onTarget(Number(event.target.value))} className="w-full accent-[hsl(var(--primary))]" />
      </div>
      <div>
        <label htmlFor="reward-image" className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/40 p-6 text-center hover:bg-muted">
          <ImagePlus className="mb-2 h-8 w-8 text-primary" /><span className="font-semibold">{image ? image.name : "Chọn ảnh phần thưởng"}</span><span className="mt-1 text-sm text-muted-foreground">JPG, PNG hoặc WebP · tối đa 5 MB</span>
        </label>
        <input id="reward-image" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => onImage(event.target.files?.[0] ?? null)} />
      </div>
      <div className="flex justify-end pt-2"><Button type="submit" className="rounded-xl" disabled={submitting || !title.trim()}>{submitting && <Loader2 className="animate-spin" />}Lưu phần thưởng</Button></div>
    </form>
  );
}

function Metric({ icon: Icon, label, value, tone = "green" }: { icon: typeof Target; label: string; value: string; tone?: "green" | "orange" | "blue" }) {
  const styles = { green: "bg-accent text-primary", orange: "bg-secondary text-orange-700", blue: "bg-blue-50 text-blue-700" };
  return <div className="min-w-[86px] rounded-2xl border bg-background p-3 sm:min-w-[108px]"><div className={cn("mb-2 grid h-8 w-8 place-items-center rounded-xl", styles[tone])}><Icon className="h-4 w-4" /></div><p className="text-xl font-bold sm:text-2xl">{value}</p><p className="text-xs text-muted-foreground sm:text-sm">{label}</p></div>;
}

function ProgressRing({ value }: { value: number }) {
  return <div className="grid h-20 w-20 place-items-center rounded-full" style={{ background: `conic-gradient(white ${value * 3.6}deg, rgba(255,255,255,.18) 0deg)` }}><div className="grid h-14 w-14 place-items-center rounded-full bg-primary text-sm font-bold">{value}%</div></div>;
}

function Loading({ text }: { text: string }) {
  return <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground"><Loader2 className="animate-spin" />{text}</div>;
}

function EmptyState({ icon: Icon, title, description, action, onAction }: { icon: typeof Gift; title: string; description: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-muted/30 px-5 py-8 text-center">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent text-primary"><Icon className="h-5 w-5" /></div>
      <p className="font-semibold">{title}</p><p className="mt-1 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
      <Button variant="outline" className="mt-4 rounded-xl bg-background" onClick={onAction}><Plus />{action}</Button>
    </div>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-label={title} className="h-full w-full max-w-md overflow-y-auto bg-card p-6 shadow-2xl sm:p-8" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-7 flex items-center justify-between"><div><p className="text-sm font-semibold text-primary">HabitGrid</p><h2 className="mt-1 text-2xl font-bold">{title}</h2></div><Button aria-label="Đóng" variant="ghost" size="icon" onClick={onClose}><X /></Button></div>
        {children}
      </section>
    </div>
  );
}
