"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  GraduationCap,
  Inbox,
  ListTodo,
  Minus,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { AssignmentShell } from "../assignment-ui";
import {
  createHabit,
  loadHabitWeek,
  setHabitCheckIn,
  updateHabit,
} from "../../src/app/apiClient";
import type { Habit, HabitCheckIn, HabitWeek } from "../../src/domain";
import {
  addDaysToDateKey,
  dateKeyDayNumber,
  formatWeekRange,
  localDateKey,
  mondayForDate,
  shiftWeekStart,
  weekDateKeys,
} from "../../src/habits";
import styles from "./habits.module.css";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const icons = {
  intake: <Inbox size={19} strokeWidth={2} />,
  habits: <CircleCheckBig size={19} strokeWidth={2} />,
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
};

type HabitDialogState =
  | { mode: "create" }
  | { mode: "edit"; habit: Habit }
  | undefined;

export function HabitsWorkspace() {
  const [today, setToday] = useState(() => new Date());
  const currentWeekStart = mondayForDate(today);
  const todayKey = localDateKey(today);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [week, setWeek] = useState<HabitWeek>({
    habits: [],
    checkIns: [],
    weekStart,
    weekEnd: addDaysToDateKey(weekStart, 6),
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [pendingCells, setPendingCells] = useState<Set<string>>(new Set());
  const [menuHabitId, setMenuHabitId] = useState<string>();
  const [dialog, setDialog] = useState<HabitDialogState>();
  const [archiveTarget, setArchiveTarget] = useState<Habit>();
  const loadVersion = useRef(0);
  const activeWeekStart = useRef(weekStart);

  useEffect(() => {
    activeWeekStart.current = weekStart;
  }, [weekStart]);

  const loadWeek = useCallback(async (targetWeek: string) => {
    const version = ++loadVersion.current;
    setLoading(true);
    setLoadError(undefined);
    try {
      const loaded = await loadHabitWeek(targetWeek);
      if (loadVersion.current === version) setWeek(loaded);
    } catch (error) {
      if (loadVersion.current === version) {
        setLoadError(error instanceof Error ? error.message : "Habits could not be loaded.");
      }
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWeek(weekStart);
  }, [loadWeek, weekStart]);

  useEffect(() => {
    const interval = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!menuHabitId) return;
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-habit-menu]")) {
        setMenuHabitId(undefined);
      }
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuHabitId]);

  const dates = useMemo(() => weekDateKeys(weekStart), [weekStart]);
  const completedKeys = useMemo(
    () => new Set(week.checkIns.map((item) => `${item.habitId}:${item.date}`)),
    [week.checkIns],
  );

  const toggleDay = async (habit: Habit, date: string) => {
    const cellKey = `${habit.id}:${date}`;
    if (date > todayKey || pendingCells.has(cellKey)) return;
    const wasCompleted = completedKeys.has(cellKey);
    const targetCompleted = !wasCompleted;
    const previousCheckIns = week.checkIns;
    const requestedWeek = weekStart;

    setActionError(undefined);
    setPendingCells((current) => new Set(current).add(cellKey));
    setWeek((current) => ({
      ...current,
      checkIns: targetCompleted
        ? [
            ...current.checkIns,
            {
              id: `optimistic:${cellKey}`,
              habitId: habit.id,
              date,
              createdAt: new Date().toISOString(),
            },
          ]
        : current.checkIns.filter(
            (item) => !(item.habitId === habit.id && item.date === date),
          ),
    }));

    try {
      const checkIn = await setHabitCheckIn(habit.id, date, targetCompleted);
      if (activeWeekStart.current === requestedWeek && checkIn) {
        setWeek((current) => ({
          ...current,
          checkIns: current.checkIns.map((item) =>
            item.id === `optimistic:${cellKey}` ? checkIn : item,
          ),
        }));
      }
    } catch (error) {
      if (activeWeekStart.current === requestedWeek) {
        setWeek((current) => ({ ...current, checkIns: previousCheckIns }));
        setActionError(
          error instanceof Error ? error.message : "The habit update could not be saved.",
        );
      }
    } finally {
      setPendingCells((current) => {
        const next = new Set(current);
        next.delete(cellKey);
        return next;
      });
    }
  };

  const saveHabit = async (name: string, targetDaysPerWeek: number) => {
    if (dialog?.mode === "edit") {
      const saved = await updateHabit(dialog.habit.id, { name, targetDaysPerWeek });
      setWeek((current) => ({
        ...current,
        habits: current.habits.map((habit) => (habit.id === saved.id ? saved : habit)),
      }));
    } else {
      const saved = await createHabit(name, targetDaysPerWeek);
      if (saved.createdAt.slice(0, 10) <= week.weekEnd) {
        setWeek((current) => ({ ...current, habits: [...current.habits, saved] }));
      }
    }
    setDialog(undefined);
  };

  const archiveHabit = async () => {
    if (!archiveTarget) return;
    try {
      await updateHabit(archiveTarget.id, { status: "archived" });
      setWeek((current) => ({
        ...current,
        habits: current.habits.filter((habit) => habit.id !== archiveTarget.id),
        checkIns: current.checkIns.filter((item) => item.habitId !== archiveTarget.id),
      }));
      setArchiveTarget(undefined);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Habit could not be deleted.");
      setArchiveTarget(undefined);
    }
  };

  return (
    <AssignmentShell activeNav="habits" icons={icons}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Habits</h1>
          <p>{week.habits.length} active {week.habits.length === 1 ? "habit" : "habits"}.</p>
        </div>
        <button
          className={styles.addButton}
          type="button"
          aria-label="Add habit"
          onClick={() => setDialog({ mode: "create" })}
        >
          <Plus size={17} aria-hidden="true" />
          <span>Add habit</span>
        </button>
      </header>

      {actionError ? (
        <div className={styles.notice} role="alert">
          <CircleAlert size={17} aria-hidden="true" />
          <span>{actionError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setActionError(undefined)}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className={styles.weekToolbar}>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Previous week"
          title="Previous week"
          onClick={() => setWeekStart((current) => shiftWeekStart(current, -1))}
        >
          <ChevronLeft size={20} />
        </button>
        <strong>{formatWeekRange(weekStart)}</strong>
        <div className={styles.weekActions}>
          {weekStart !== currentWeekStart ? (
            <button className={styles.thisWeekButton} type="button" onClick={() => setWeekStart(currentWeekStart)}>
              This week
            </button>
          ) : null}
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Next week"
            title="Next week"
            onClick={() => setWeekStart((current) => shiftWeekStart(current, 1))}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <section className={styles.tracker} aria-label={`Habits for ${formatWeekRange(weekStart)}`}>
        <div className={styles.desktopHeader} aria-hidden="true">
          <span>Habit</span>
          {dates.map((date, index) => (
            <span className={date === todayKey ? styles.todayHeader : undefined} key={date}>
              <b>{WEEKDAYS[index]}</b>
              {dateKeyDayNumber(date)}
            </span>
          ))}
          <span />
        </div>

        {loading ? <HabitSkeleton /> : null}
        {!loading && loadError ? (
          <div className={styles.state}>
            <CircleAlert size={22} />
            <h2>Habits could not be loaded</h2>
            <p>{loadError}</p>
            <button type="button" onClick={() => void loadWeek(weekStart)}>Try again</button>
          </div>
        ) : null}
        {!loading && !loadError && week.habits.length === 0 ? (
          <div className={styles.state}>
            <CircleCheckBig size={22} />
            <h2>No habits yet</h2>
            <p>Add one habit and choose how many days you want to hit each week.</p>
            <button type="button" onClick={() => setDialog({ mode: "create" })}>Add habit</button>
          </div>
        ) : null}
        {!loading && !loadError ? week.habits.map((habit) => {
          const completed = week.checkIns.filter((item) => item.habitId === habit.id).length;
          return (
            <article className={styles.habitRow} key={habit.id}>
              <div className={styles.habitInfo}>
                <h2>{habit.name}</h2>
                <div>
                  <strong>{completed} of {habit.targetDaysPerWeek}</strong>
                  <span>Target {habit.targetDaysPerWeek} days/week</span>
                </div>
              </div>
              <div className={styles.dayGrid}>
                {dates.map((date, index) => {
                  const cellKey = `${habit.id}:${date}`;
                  const isCompleted = completedKeys.has(cellKey);
                  const isFuture = date > todayKey;
                  const isToday = date === todayKey;
                  return (
                    <div className={styles.dayCell} key={date}>
                      <span className={styles.mobileDayLabel}>
                        <b>{WEEKDAYS[index]?.slice(0, 1)}</b>
                        {dateKeyDayNumber(date)}
                      </span>
                      <button
                        className={styles.dayButton}
                        type="button"
                        data-completed={isCompleted}
                        data-today={isToday}
                        data-future={isFuture}
                        disabled={isFuture || pendingCells.has(cellKey)}
                        aria-pressed={isCompleted}
                        aria-label={`${habit.name}, ${WEEKDAYS[index]} ${dateKeyDayNumber(date)}: ${isCompleted ? "completed" : isFuture ? "future date" : "not completed"}`}
                        onClick={() => void toggleDay(habit, date)}
                      >
                        {isCompleted ? <Check size={22} strokeWidth={2.7} aria-hidden="true" /> : null}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className={styles.menuWrap} data-habit-menu>
                <button
                  className={styles.rowMenuButton}
                  type="button"
                  aria-label={`Actions for ${habit.name}`}
                  aria-expanded={menuHabitId === habit.id}
                  onClick={() => setMenuHabitId((current) => current === habit.id ? undefined : habit.id)}
                >
                  <MoreVertical size={18} />
                </button>
                {menuHabitId === habit.id ? (
                  <div className={styles.rowMenu} role="menu">
                    <button type="button" role="menuitem" onClick={() => {
                      setDialog({ mode: "edit", habit });
                      setMenuHabitId(undefined);
                    }}>
                      <Pencil size={15} />
                      Edit
                    </button>
                    <button type="button" role="menuitem" onClick={() => {
                      setArchiveTarget(habit);
                      setMenuHabitId(undefined);
                    }}>
                      <Trash2 size={15} />
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            </article>
          );
        }) : null}
      </section>

      {dialog ? (
        <HabitDialog
          state={dialog}
          onClose={() => setDialog(undefined)}
          onSave={saveHabit}
        />
      ) : null}
      {archiveTarget ? (
        <ConfirmDelete
          habit={archiveTarget}
          onCancel={() => setArchiveTarget(undefined)}
          onConfirm={archiveHabit}
        />
      ) : null}
    </AssignmentShell>
  );
}

function HabitDialog({
  state,
  onClose,
  onSave,
}: {
  state: Exclude<HabitDialogState, undefined>;
  onClose: () => void;
  onSave: (name: string, target: number) => Promise<void>;
}) {
  const [name, setName] = useState(state.mode === "edit" ? state.habit.name : "");
  const [target, setTarget] = useState(state.mode === "edit" ? state.habit.targetDaysPerWeek : 4);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSave(name.trim(), target);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Habit could not be saved.");
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalBackdrop}>
      <button className={styles.scrim} type="button" aria-label="Close habit dialog" onClick={onClose} />
      <form
        className={styles.habitDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="habit-dialog-title"
        onSubmit={submit}
      >
        <header>
          <h2 id="habit-dialog-title">{state.mode === "edit" ? "Edit habit" : "New habit"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <label>
          Habit name
          <input
            ref={inputRef}
            value={name}
            maxLength={120}
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="e.g., Morning stretch"
          />
        </label>
        <fieldset>
          <legend>Days per week</legend>
          <div className={styles.stepper}>
            <button type="button" aria-label="Decrease days per week" disabled={target <= 1} onClick={() => setTarget((value) => value - 1)}>
              <Minus size={18} />
            </button>
            <output aria-live="polite">{target}</output>
            <button type="button" aria-label="Increase days per week" disabled={target >= 7} onClick={() => setTarget((value) => value + 1)}>
              <Plus size={18} />
            </button>
          </div>
        </fieldset>
        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
        <footer>
          <button className={styles.cancelButton} type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={styles.saveButton} type="submit" disabled={!name.trim() || saving}>
            {saving ? "Saving..." : state.mode === "edit" ? "Save changes" : "Add habit"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ConfirmDelete({
  habit,
  onCancel,
  onConfirm,
}: {
  habit: Habit;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className={styles.modalBackdrop}>
      <button className={styles.scrim} type="button" aria-label="Cancel deleting habit" onClick={onCancel} />
      <section className={styles.confirmDialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-habit-title">
        <h2 id="delete-habit-title">Delete {habit.name}?</h2>
        <p>This removes it from Habits. Past check-ins stay saved.</p>
        <footer>
          <button className={styles.cancelButton} type="button" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className={styles.deleteButton} type="button" disabled={deleting} onClick={() => {
            setDeleting(true);
            void onConfirm();
          }}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function HabitSkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading habits" aria-busy="true">
      {Array.from({ length: 3 }, (_, index) => <div key={index} />)}
    </div>
  );
}
