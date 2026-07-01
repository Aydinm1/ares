"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Clock, Pencil, X } from "lucide-react";
import { assignmentDueInputParts } from "../../src/assignments";
import type { AssignmentEditorUpdate } from "../../src/app/apiClient";
import type { Assignment, Course } from "../../src/domain";
import type { AssignmentCalendarDay, AssignmentListItem } from "../assignment-ui";
import styles from "./assignment-editor.module.css";

const WEEK_OPTIONS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "Finals"];

export type AssignmentDrawerState =
  | { kind: "agenda"; dateKey: string }
  | { kind: "editor"; assignmentId: string; returnDateKey?: string };

interface AssignmentEditorDrawerProps {
  state?: AssignmentDrawerState;
  assignment?: Assignment;
  agendaDay?: AssignmentCalendarDay;
  courses: Course[];
  saving: boolean;
  saveError?: string;
  onClose: () => void;
  onEditAssignment: (assignmentId: string, returnDateKey?: string) => void;
  onBackToAgenda: (dateKey: string) => void;
  onSave: (assignmentId: string, update: AssignmentEditorUpdate) => Promise<void>;
}

export function AssignmentEditorDrawer({
  state,
  assignment,
  agendaDay,
  courses,
  saving,
  saveError,
  onClose,
  onEditAssignment,
  onBackToAgenda,
  onSave,
}: AssignmentEditorDrawerProps) {
  const closeHandlerRef = useRef(onClose);
  const drawerRef = useRef<HTMLElement>(null);
  closeHandlerRef.current = onClose;

  useEffect(() => {
    if (!state) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state.kind === "agenda") {
        event.preventDefault();
        closeHandlerRef.current();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [state]);

  if (!state) return null;

  return (
    <div className={styles.backdrop} role="presentation">
      <button
        className={styles.scrim}
        type="button"
        aria-label="Close assignment drawer"
        onClick={() => closeHandlerRef.current()}
      />
      <aside
        ref={drawerRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label="Assignment details"
      >
        {state.kind === "agenda" ? (
          <DayAgenda day={agendaDay} onClose={onClose} onEdit={onEditAssignment} />
        ) : assignment ? (
          <AssignmentEditor
            key={assignment.id}
            assignment={assignment}
            courses={courses}
            saving={saving}
            saveError={saveError}
            returnDateKey={state.returnDateKey}
            onClose={onClose}
            onBack={onBackToAgenda}
            onSave={onSave}
            registerCloseHandler={(handler) => {
              closeHandlerRef.current = handler;
            }}
          />
        ) : null}
      </aside>
    </div>
  );
}

function DayAgenda({
  day,
  onClose,
  onEdit,
}: {
  day?: AssignmentCalendarDay;
  onClose: () => void;
  onEdit: (assignmentId: string, returnDateKey?: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => closeRef.current?.focus(), []);
  if (!day) return null;

  return (
    <>
      <header className={styles.drawerHeader}>
        <div>
          <p className={styles.eyebrow}>Day agenda</p>
          <h2 className={styles.drawerTitle}>{day.accessibleLabel}</h2>
          <p className={styles.drawerSubtitle}>
            {day.entries.length} {day.entries.length === 1 ? "assignment" : "assignments"} due
          </p>
        </div>
        <button ref={closeRef} className={styles.iconButton} type="button" aria-label="Close day agenda" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className={styles.agendaList}>
        {day.entries.map((entry) => (
          <button
            className={styles.agendaItem}
            type="button"
            key={entry.id}
            onClick={() => onEdit(entry.id, day.key)}
          >
            <span className={styles.agendaDot} style={{ background: entry.courseColor }} aria-hidden="true" />
            <span className={styles.agendaCopy}>
              <strong>{entry.title}</strong>
              <span>{entry.item.courseName}</span>
            </span>
            <Pencil size={15} aria-hidden="true" />
          </button>
        ))}
      </div>
    </>
  );
}

interface EditorValues {
  title: string;
  courseId: string;
  dueDate: string;
  dueTime: string;
  pointsPossible: string;
  weekLabel: string;
}

function AssignmentEditor({
  assignment,
  courses,
  saving,
  saveError,
  returnDateKey,
  onClose,
  onBack,
  onSave,
  registerCloseHandler,
}: {
  assignment: Assignment;
  courses: Course[];
  saving: boolean;
  saveError?: string;
  returnDateKey?: string;
  onClose: () => void;
  onBack: (dateKey: string) => void;
  onSave: (assignmentId: string, update: AssignmentEditorUpdate) => Promise<void>;
  registerCloseHandler: (handler: () => void) => void;
}) {
  const initialValues = useMemo(() => valuesFromAssignment(assignment), [assignment]);
  const [values, setValues] = useState(initialValues);
  const [discardAction, setDiscardAction] = useState<"close" | "back">();
  const titleRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);
  const points = values.pointsPossible === "" ? null : Number(values.pointsPossible);
  const valid =
    values.title.trim().length > 0 &&
    values.title.trim().length <= 200 &&
    (points === null || (Number.isFinite(points) && points >= 0)) &&
    (!values.dueTime || Boolean(values.dueDate));

  useEffect(() => titleRef.current?.focus(), []);

  const requestClose = () => {
    if (dirty && !saving) {
      setDiscardAction("close");
      return;
    }
    onClose();
  };

  useEffect(() => {
    registerCloseHandler(requestClose);
    return () => registerCloseHandler(onClose);
  });

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      requestClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  });

  const sortedCourses = useMemo(
    () =>
      [...courses].sort((left, right) => {
        const leftActive = left.status === "in_progress";
        const rightActive = right.status === "in_progress";
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        return left.name.localeCompare(right.name);
      }),
    [courses],
  );

  return (
    <form
      className={styles.editor}
      onSubmit={(event) => {
        event.preventDefault();
        if (!dirty || !valid || saving) return;
        void onSave(assignment.id, {
          title: values.title.trim(),
          courseId: values.courseId || null,
          dueDate: values.dueDate || null,
          dueTime: values.dueDate ? values.dueTime || null : null,
          pointsPossible: points,
          weekLabel: values.weekLabel || null,
        });
      }}
    >
      <header className={styles.drawerHeader}>
        <div className={styles.headerLead}>
          {returnDateKey ? (
            <button
              className={styles.iconButton}
              type="button"
              aria-label="Back to day agenda"
              onClick={() => (dirty ? setDiscardAction("back") : onBack(returnDateKey))}
            >
              <ArrowLeft size={18} />
            </button>
          ) : null}
          <div>
            <p className={styles.eyebrow}>Edit assignment</p>
            <h2 className={styles.drawerTitle}>Assignment details</h2>
          </div>
        </div>
        <button className={styles.iconButton} type="button" aria-label="Close assignment editor" onClick={requestClose}>
          <X size={18} />
        </button>
      </header>

      <div className={styles.formBody}>
        {saveError ? <div className={styles.formError} role="alert">{saveError}</div> : null}
        <label className={styles.field}>
          <span>Title</span>
          <input
            ref={titleRef}
            value={values.title}
            maxLength={200}
            onChange={(event) => {
              const title = event.currentTarget.value;
              setValues((current) => ({ ...current, title }));
            }}
          />
        </label>

        <label className={styles.field}>
          <span>Course</span>
          <select
            value={values.courseId}
            onChange={(event) => {
              const courseId = event.currentTarget.value;
              setValues((current) => ({ ...current, courseId }));
            }}
          >
            <option value="">No linked course</option>
            {sortedCourses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.status === "in_progress" ? `${course.name} (In progress)` : course.name}
              </option>
            ))}
          </select>
        </label>

        <div className={styles.dateGrid}>
          <label className={styles.field}>
            <span><CalendarDays size={14} aria-hidden="true" /> Due date</span>
            <input
              type="date"
              value={values.dueDate}
              onChange={(event) => {
                const dueDate = event.currentTarget.value;
                setValues((current) => ({
                  ...current,
                  dueDate,
                  dueTime: dueDate ? current.dueTime : "",
                }));
              }}
            />
          </label>
          <label className={styles.field}>
            <span><Clock size={14} aria-hidden="true" /> Time <em>optional</em></span>
            <input
              type="time"
              value={values.dueTime}
              disabled={!values.dueDate}
              onChange={(event) => {
                const dueTime = event.currentTarget.value;
                setValues((current) => ({ ...current, dueTime }));
              }}
            />
          </label>
        </div>
        {values.dueDate ? (
          <button
            className={styles.clearDate}
            type="button"
            onClick={() => setValues((current) => ({ ...current, dueDate: "", dueTime: "" }))}
          >
            Clear due date
          </button>
        ) : null}

        <div className={styles.twoColumn}>
          <label className={styles.field}>
            <span>Points possible</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={values.pointsPossible}
              onChange={(event) => {
                const pointsPossible = event.currentTarget.value;
                setValues((current) => ({ ...current, pointsPossible }));
              }}
            />
          </label>
          <label className={styles.field}>
            <span>Week</span>
            <select
              value={values.weekLabel}
              onChange={(event) => {
                const weekLabel = event.currentTarget.value;
                setValues((current) => ({ ...current, weekLabel }));
              }}
            >
              <option value="">Not set</option>
              {WEEK_OPTIONS.map((week) => <option value={week} key={week}>{week}</option>)}
            </select>
          </label>
        </div>

        <div className={styles.readOnlyField}>
          <span>Assignment type</span>
          <strong>{assignment.typeLabel ?? "Not set"}</strong>
          <small>Managed in Airtable until the type taxonomy is expanded.</small>
        </div>
      </div>

      <footer className={styles.editorFooter}>
        <button className={styles.secondaryButton} type="button" onClick={requestClose} disabled={saving}>
          Cancel
        </button>
        <button className={styles.primaryButton} type="submit" disabled={!dirty || !valid || saving}>
          {saving ? "Saving..." : "Save changes"}
        </button>
      </footer>

      {discardAction ? (
        <div className={styles.discardPrompt} role="alertdialog" aria-modal="true" aria-label="Discard unsaved changes">
          <div>
            <strong>Discard unsaved changes?</strong>
            <p>Your edits have not been saved to Airtable.</p>
          </div>
          <div className={styles.discardActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => setDiscardAction(undefined)}>
              Keep editing
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={() => {
                if (discardAction === "back" && returnDateKey) onBack(returnDateKey);
                else onClose();
              }}
            >
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function valuesFromAssignment(assignment: Assignment): EditorValues {
  const { dueDate, dueTime } = assignmentDueInputParts(assignment.dueAt);
  return {
    title: assignment.title,
    courseId: assignment.courseId ?? "",
    dueDate,
    dueTime,
    pointsPossible: assignment.pointsPossible?.toString() ?? "",
    weekLabel: assignment.weekLabel ?? "",
  };
}
