"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheckBig,
  Compass,
  GraduationCap,
  Inbox,
  ListTodo,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { AssignmentShell } from "../assignment-ui";
import {
  createCompetency,
  createCompetencyFocus,
  loadCompetencies,
  reorderCompetencies,
  updateCompetency,
  updateCompetencyFocus,
} from "../../src/app/apiClient";
import type {
  Competency,
  CompetencyFocus,
  CompetencyOverview,
  CompetencyStatus,
} from "../../src/domain";
import styles from "./competencies.module.css";

const icons = {
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  intake: <Inbox size={19} strokeWidth={2} />,
  habits: <CircleCheckBig size={19} strokeWidth={2} />,
  competencies: <Compass size={19} strokeWidth={2} />,
};

const STATUS_LABELS: Record<CompetencyStatus, string> = {
  current: "Current",
  dormant: "Dormant",
  someday: "Someday",
  archived: "Archived",
};

const STATUS_GROUPS: Array<{ status: CompetencyStatus; label: string }> = [
  { status: "current", label: "Current" },
  { status: "dormant", label: "Dormant" },
  { status: "someday", label: "Someday" },
];

type CompetencyDialogState =
  | { mode: "create" }
  | { mode: "edit"; overview: CompetencyOverview }
  | undefined;

type FocusDialogState =
  | { mode: "create"; competency: Competency }
  | { mode: "edit"; focus: CompetencyFocus }
  | { mode: "end"; focus: CompetencyFocus }
  | { mode: "restart"; competency: Competency; focus: CompetencyFocus }
  | undefined;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRange(focus: CompetencyFocus): string {
  return focus.endedAt ? `${focus.startedAt} -> ${focus.endedAt}` : `Started ${focus.startedAt}`;
}

function sortFocuses(focuses: CompetencyFocus[]): CompetencyFocus[] {
  return [...focuses].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function CompetenciesWorkspace() {
  const [overviews, setOverviews] = useState<CompetencyOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [expandedId, setExpandedId] = useState<string>();
  const [menuId, setMenuId] = useState<string>();
  const [dialog, setDialog] = useState<CompetencyDialogState>();
  const [focusDialog, setFocusDialog] = useState<FocusDialogState>();
  const [reorderingId, setReorderingId] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(undefined);
    try {
      setOverviews(await loadCompetencies());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Identity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!menuId) return;
    const closeMenu = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-competency-menu]")) setMenuId(undefined);
    };
    document.addEventListener("pointerdown", closeMenu);
    return () => document.removeEventListener("pointerdown", closeMenu);
  }, [menuId]);

  const grouped = useMemo(
    () => STATUS_GROUPS.map((group) => ({
      ...group,
      overviews: overviews.filter((overview) => overview.competency.status === group.status),
    })),
    [overviews],
  );

  const saveCompetency = async (input: {
    name: string;
    category?: string;
    status?: CompetencyStatus;
    vision?: string;
    description?: string;
  }) => {
    setActionError(undefined);
    if (dialog?.mode === "edit") {
      const saved = await updateCompetency(dialog.overview.competency.id, input);
      setOverviews((current) => current.map((overview) =>
        overview.competency.id === saved.id ? { ...overview, competency: saved } : overview
      ).filter((overview) => overview.competency.status !== "archived"));
    } else {
      const saved = await createCompetency(input);
      setOverviews((current) => [
        ...current,
        { competency: saved, historicalFocuses: [] },
      ]);
      setExpandedId(saved.id);
    }
    setDialog(undefined);
  };

  const archiveCompetency = async (overview: CompetencyOverview) => {
    setActionError(undefined);
    try {
      await updateCompetency(overview.competency.id, { status: "archived" });
      setOverviews((current) =>
        current.filter((item) => item.competency.id !== overview.competency.id)
      );
      setMenuId(undefined);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Competency could not be archived.");
    }
  };

  const moveCompetency = async (overview: CompetencyOverview, direction: "up" | "down") => {
    const sameStatus = overviews.filter(
      (item) => item.competency.status === overview.competency.status
    );
    const currentIndex = sameStatus.findIndex(
      (item) => item.competency.id === overview.competency.id
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sameStatus.length) return;

    const previous = overviews;
    const nextStatusOrder = [...sameStatus];
    [nextStatusOrder[currentIndex], nextStatusOrder[targetIndex]] = [
      nextStatusOrder[targetIndex]!,
      nextStatusOrder[currentIndex]!,
    ];
    let statusIndex = 0;
    const next = overviews.map((item) =>
      item.competency.status === overview.competency.status
        ? nextStatusOrder[statusIndex++]!
        : item
    );
    setOverviews(next);
    setMenuId(undefined);
    setReorderingId(overview.competency.id);
    try {
      await reorderCompetencies(nextStatusOrder.map((item) => item.competency.id));
    } catch (error) {
      setOverviews(previous);
      setActionError(error instanceof Error ? error.message : "Competency order could not be saved.");
    } finally {
      setReorderingId(undefined);
    }
  };

  const saveFocus = async (state: Exclude<FocusDialogState, undefined>, input: {
    title?: string;
    startedAt?: string;
    endedAt?: string;
    notes?: string | null;
    endReason?: string | null;
  }) => {
    setActionError(undefined);
    if (state.mode === "create" || state.mode === "restart") {
      const competencyId = state.competency.id;
      const focus = await createCompetencyFocus(competencyId, {
        title: input.title ?? "",
        startedAt: input.startedAt ?? todayKey(),
        notes: input.notes ?? undefined,
      });
      setOverviews((current) => current.map((overview) => {
        if (overview.competency.id !== competencyId) return overview;
        const previousCurrent = overview.currentFocus
          ? { ...overview.currentFocus, endedAt: focus.startedAt }
          : undefined;
        return {
          ...overview,
          currentFocus: focus,
          historicalFocuses: sortFocuses([
            ...overview.historicalFocuses,
            ...(previousCurrent ? [previousCurrent] : []),
          ]),
        };
      }));
    } else {
      const focus = await updateCompetencyFocus(state.focus.id, input);
      setOverviews((current) => current.map((overview) => {
        if (overview.competency.id !== focus.competencyId) return overview;
        const all = [
          ...(overview.currentFocus && overview.currentFocus.id !== focus.id
            ? [overview.currentFocus]
            : []),
          ...overview.historicalFocuses.filter((item) => item.id !== focus.id),
          focus,
        ];
        return {
          ...overview,
          currentFocus: all.find((item) => !item.endedAt),
          historicalFocuses: sortFocuses(all.filter((item) => item.endedAt)),
        };
      }));
    }
    setFocusDialog(undefined);
  };

  return (
    <AssignmentShell activeNav="competencies" icons={icons}>
      <header className={styles.pageHeader}>
        <div>
          <h1>Identity</h1>
          <p>{overviews.length} visible {overviews.length === 1 ? "competency" : "competencies"}.</p>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => setDialog({ mode: "create" })}>
          <Plus size={17} />
          <span>Add competency</span>
        </button>
      </header>

      {actionError ? (
        <div className={styles.notice} role="alert">
          <CircleAlert size={17} />
          <span>{actionError}</span>
          <button type="button" aria-label="Dismiss error" onClick={() => setActionError(undefined)}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      {loading ? <CompetencySkeleton /> : null}
      {!loading && loadError ? (
        <div className={styles.state}>
          <CircleAlert size={22} />
          <h2>Identity could not be loaded</h2>
          <p>{loadError}</p>
          <button type="button" onClick={() => void load()}>Try again</button>
        </div>
      ) : null}
      {!loading && !loadError && overviews.length === 0 ? (
        <div className={styles.state}>
          <Compass size={22} />
          <h2>No competencies yet</h2>
          <p>Add one long-term capability you want to keep visible.</p>
          <button type="button" onClick={() => setDialog({ mode: "create" })}>Add competency</button>
        </div>
      ) : null}

      {!loading && !loadError ? grouped.map((group) => group.overviews.length > 0 ? (
        <section className={styles.group} key={group.status} aria-labelledby={`skills-${group.status}`}>
          <header className={styles.groupHeader}>
            <h2 id={`skills-${group.status}`}>{group.label}</h2>
            <span>{group.overviews.length}</span>
          </header>
          <div className={styles.skillList}>
            {group.overviews.map((overview, index) => (
              <article className={styles.skillRow} key={overview.competency.id}>
                <button
                  className={styles.skillMain}
                  type="button"
                  onClick={() => setExpandedId((current) =>
                    current === overview.competency.id ? undefined : overview.competency.id
                  )}
                  aria-expanded={expandedId === overview.competency.id}
                >
                  <span className={styles.skillTitle}>
                    <strong>{overview.competency.name}</strong>
                    {overview.competency.category ? <em>{overview.competency.category}</em> : null}
                  </span>
                  <span className={styles.focusSummary}>
                    {overview.currentFocus ? overview.currentFocus.title : "No current focus"}
                  </span>
                </button>
                <div className={styles.statusPill}>{STATUS_LABELS[overview.competency.status]}</div>
                <div className={styles.menuWrap} data-competency-menu>
                  <button
                    className={styles.iconButton}
                    type="button"
                    aria-label={`Actions for ${overview.competency.name}`}
                    aria-expanded={menuId === overview.competency.id}
                    onClick={() => setMenuId((current) =>
                      current === overview.competency.id ? undefined : overview.competency.id
                    )}
                  >
                    <MoreVertical size={18} />
                  </button>
                  {menuId === overview.competency.id ? (
                    <div className={styles.rowMenu} role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={index === 0 || reorderingId !== undefined}
                        onClick={() => void moveCompetency(overview, "up")}
                      >
                        <ArrowUp size={15} />
                        Move up
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={index === group.overviews.length - 1 || reorderingId !== undefined}
                        onClick={() => void moveCompetency(overview, "down")}
                      >
                        <ArrowDown size={15} />
                        Move down
                      </button>
                      <button type="button" role="menuitem" onClick={() => {
                        setDialog({ mode: "edit", overview });
                        setMenuId(undefined);
                      }}>
                        <Pencil size={15} />
                        Edit
                      </button>
                      <button type="button" role="menuitem" onClick={() => void archiveCompetency(overview)}>
                        <Trash2 size={15} />
                        Archive
                      </button>
                    </div>
                  ) : null}
                </div>

                {expandedId === overview.competency.id ? (
                  <CompetencyDetail
                    overview={overview}
                    onAddFocus={() => setFocusDialog({ mode: "create", competency: overview.competency })}
                    onEditFocus={(focus) => setFocusDialog({ mode: "edit", focus })}
                    onEndFocus={(focus) => setFocusDialog({ mode: "end", focus })}
                    onRestartFocus={(focus) => setFocusDialog({
                      mode: "restart",
                      competency: overview.competency,
                      focus,
                    })}
                  />
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null) : null}

      {dialog ? (
        <CompetencyDialog
          state={dialog}
          onClose={() => setDialog(undefined)}
          onSave={saveCompetency}
        />
      ) : null}
      {focusDialog ? (
        <FocusDialog
          state={focusDialog}
          onClose={() => setFocusDialog(undefined)}
          onSave={saveFocus}
        />
      ) : null}
    </AssignmentShell>
  );
}

function CompetencyDetail({
  overview,
  onAddFocus,
  onEditFocus,
  onEndFocus,
  onRestartFocus,
}: {
  overview: CompetencyOverview;
  onAddFocus: () => void;
  onEditFocus: (focus: CompetencyFocus) => void;
  onEndFocus: (focus: CompetencyFocus) => void;
  onRestartFocus: (focus: CompetencyFocus) => void;
}) {
  return (
    <div className={styles.detail}>
      {overview.competency.vision ? (
        <section>
          <h3>Vision</h3>
          <p>{overview.competency.vision}</p>
        </section>
      ) : null}
      {overview.competency.description ? (
        <section>
          <h3>Description</h3>
          <p>{overview.competency.description}</p>
        </section>
      ) : null}
      <section>
        <div className={styles.detailHeader}>
          <h3>Current focus</h3>
          <button type="button" onClick={onAddFocus}>
            <Plus size={15} />
            <span>{overview.currentFocus ? "Switch focus" : "Add focus"}</span>
          </button>
        </div>
        {overview.currentFocus ? (
          <FocusItem
            focus={overview.currentFocus}
            current
            onEdit={() => onEditFocus(overview.currentFocus!)}
            onEnd={() => onEndFocus(overview.currentFocus!)}
            onRestart={() => onRestartFocus(overview.currentFocus!)}
          />
        ) : (
          <p className={styles.emptyLine}>No current focus.</p>
        )}
      </section>
      <section>
        <h3>Focus timeline</h3>
        {overview.historicalFocuses.length > 0 ? (
          <div className={styles.timeline}>
            {overview.historicalFocuses.map((focus) => (
              <FocusItem
                key={focus.id}
                focus={focus}
                onEdit={() => onEditFocus(focus)}
                onEnd={() => onEndFocus(focus)}
                onRestart={() => onRestartFocus(focus)}
              />
            ))}
          </div>
        ) : (
          <p className={styles.emptyLine}>No previous focuses.</p>
        )}
      </section>
    </div>
  );
}

function FocusItem({
  focus,
  current = false,
  onEdit,
  onEnd,
  onRestart,
}: {
  focus: CompetencyFocus;
  current?: boolean;
  onEdit: () => void;
  onEnd: () => void;
  onRestart: () => void;
}) {
  return (
    <div className={styles.focusItem} data-current={current}>
      <div>
        <strong>{focus.title}</strong>
        <span>{formatDateRange(focus)}</span>
        {focus.notes ? <p>{focus.notes}</p> : null}
        {focus.endReason ? <p><b>End reason:</b> {focus.endReason}</p> : null}
      </div>
      <div className={styles.focusActions}>
        <button type="button" aria-label={`Edit ${focus.title}`} onClick={onEdit}>
          <Pencil size={15} />
        </button>
        {current ? (
          <button type="button" aria-label={`End ${focus.title}`} onClick={onEnd}>
            <Square size={15} />
          </button>
        ) : (
          <button type="button" aria-label={`Restart ${focus.title} as new`} onClick={onRestart}>
            <RotateCcw size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

function CompetencyDialog({
  state,
  onClose,
  onSave,
}: {
  state: Exclude<CompetencyDialogState, undefined>;
  onClose: () => void;
  onSave: (input: {
    name: string;
    category?: string;
    status?: CompetencyStatus;
    vision?: string;
    description?: string;
  }) => Promise<void>;
}) {
  const competency = state.mode === "edit" ? state.overview.competency : undefined;
  const [name, setName] = useState(competency?.name ?? "");
  const [category, setCategory] = useState(competency?.category ?? "");
  const [status, setStatus] = useState<CompetencyStatus>(competency?.status ?? "current");
  const [vision, setVision] = useState(competency?.vision ?? "");
  const [description, setDescription] = useState(competency?.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await onSave({
        name,
        category: category || undefined,
        status,
        vision: vision || undefined,
        description: description || undefined,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Competency could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <button className={styles.scrim} type="button" aria-label="Close competency dialog" onClick={onClose} />
      <form className={styles.dialog} onSubmit={submit}>
        <header>
          <h2>{state.mode === "edit" ? "Edit competency" : "New competency"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </header>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
        </label>
        <label>
          Category
          <input value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as CompetencyStatus)}>
            <option value="current">Current</option>
            <option value="dormant">Dormant</option>
            <option value="someday">Someday</option>
          </select>
        </label>
        <label>
          Vision
          <textarea value={vision} onChange={(event) => setVision(event.target.value)} rows={3} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>
        {error ? <p className={styles.formError}>{error}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </footer>
      </form>
    </div>
  );
}

function FocusDialog({
  state,
  onClose,
  onSave,
}: {
  state: Exclude<FocusDialogState, undefined>;
  onClose: () => void;
  onSave: (state: Exclude<FocusDialogState, undefined>, input: {
    title?: string;
    startedAt?: string;
    endedAt?: string;
    notes?: string | null;
    endReason?: string | null;
  }) => Promise<void>;
}) {
  const source = "focus" in state ? state.focus : undefined;
  const [title, setTitle] = useState(source?.title ?? "");
  const [startedAt, setStartedAt] = useState(state.mode === "restart" ? todayKey() : source?.startedAt ?? todayKey());
  const [endedAt, setEndedAt] = useState(state.mode === "end" ? todayKey() : source?.endedAt ?? "");
  const [notes, setNotes] = useState(source?.notes ?? "");
  const [endReason, setEndReason] = useState(source?.endReason ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const isEndOnly = state.mode === "end";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await onSave(state, isEndOnly
        ? { endedAt, endReason: endReason || null }
        : {
            title,
            startedAt,
            endedAt: state.mode === "edit" && endedAt ? endedAt : undefined,
            notes: notes || null,
            endReason: state.mode === "edit" ? endReason || null : undefined,
          }
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Focus could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay}>
      <button className={styles.scrim} type="button" aria-label="Close focus dialog" onClick={onClose} />
      <form className={styles.dialog} onSubmit={submit}>
        <header>
          <h2>{state.mode === "end" ? "End focus" : state.mode === "restart" ? "Restart as new" : "Focus"}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={17} /></button>
        </header>
        {!isEndOnly ? (
          <>
            <label>
              Title
              <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} />
            </label>
            <label>
              Started at
              <input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required />
            </label>
            {state.mode === "edit" && source?.endedAt ? (
              <label>
                Ended at
                <input type="date" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} />
              </label>
            ) : null}
            <label>
              Notes
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
            </label>
          </>
        ) : null}
        {(isEndOnly || (state.mode === "edit" && source?.endedAt)) ? (
          <label>
            End reason
            <textarea value={endReason} onChange={(event) => setEndReason(event.target.value)} rows={3} />
          </label>
        ) : null}
        {isEndOnly ? (
          <label>
            Ended at
            <input type="date" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} required />
          </label>
        ) : null}
        {error ? <p className={styles.formError}>{error}</p> : null}
        <footer>
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
        </footer>
      </form>
    </div>
  );
}

function CompetencySkeleton() {
  return (
    <div className={styles.skeleton} aria-label="Loading identity" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => <span key={index} />)}
    </div>
  );
}
