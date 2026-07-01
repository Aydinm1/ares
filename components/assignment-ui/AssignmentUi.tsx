"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { InboxQuickCapture } from "../inbox/InboxCapture";
import styles from "./assignment-ui.module.css";

export type AssignmentDueTone = "overdue" | "today" | "soon" | "normal" | "undated";
export type AssignmentSyncState = "synced" | "syncing" | "error";
export type AssignmentMobileView = "list" | "calendar";
export type AssignmentCompletionFeedback = "confirmed" | "exiting";

export interface AssignmentUiIcons {
  brand: ReactNode;
  assignments: ReactNode;
  courses: ReactNode;
  intake: ReactNode;
  calendar: ReactNode;
  list: ReactNode;
  previous: ReactNode;
  next: ReactNode;
  today: ReactNode;
  sync: ReactNode;
  filter: ReactNode;
  edit: ReactNode;
  close: ReactNode;
  empty: ReactNode;
  error: ReactNode;
}

export interface AssignmentListItem {
  id: string;
  title: string;
  courseName: string;
  courseColor: string;
  dueLabel: string;
  dueExact?: string;
  dueTone: AssignmentDueTone;
  completed: boolean;
  saving?: boolean;
  completionFeedback?: AssignmentCompletionFeedback;
}

export interface AssignmentCalendarEntry {
  id: string;
  title: string;
  courseColor: string;
  completed: boolean;
  item: AssignmentListItem;
}

export interface AssignmentCalendarDay {
  key: string;
  dayNumber: number;
  accessibleLabel: string;
  isToday: boolean;
  isOutsideMonth: boolean;
  entries: AssignmentCalendarEntry[];
}

export interface CourseFilterOption {
  id: string;
  label: string;
}

interface AssignmentShellProps {
  brandName?: string;
  activeNav: "intake" | "assignments" | "courses";
  icons: Pick<AssignmentUiIcons, "brand" | "intake" | "assignments" | "courses">;
  children: ReactNode;
}

export function AssignmentShell({
  brandName = "Personal OS",
  activeNav,
  icons,
  children,
}: AssignmentShellProps) {
  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">
            {icons.brand}
          </span>
          <span className={styles.brandName}>{brandName}</span>
        </div>
        <div className={styles.topbarActions}>
          {activeNav !== "intake" ? <InboxQuickCapture /> : null}
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <Link
              className={`${styles.mobileNavItem} ${activeNav === "intake" ? styles.mobileNavItemActive : ""}`}
              href="/"
              aria-label="Intake"
              aria-current={activeNav === "intake" ? "page" : undefined}
            >
              {icons.intake}
            </Link>
            <Link
              className={`${styles.mobileNavItem} ${activeNav === "assignments" ? styles.mobileNavItemActive : ""}`}
              href="/assignments"
              aria-label="Assignments"
              aria-current={activeNav === "assignments" ? "page" : undefined}
            >
              {icons.assignments}
            </Link>
            <Link
              className={`${styles.mobileNavItem} ${activeNav === "courses" ? styles.mobileNavItemActive : ""}`}
              href="/courses"
              aria-label="4 Year Plan"
              aria-current={activeNav === "courses" ? "page" : undefined}
            >
              {icons.courses}
            </Link>
          </nav>
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar} aria-label="Primary navigation">
          <p className={styles.sidebarLabel}>Workspace</p>
          <Link
            className={`${styles.navItem} ${activeNav === "intake" ? styles.navItemActive : ""}`}
            href="/"
            aria-current={activeNav === "intake" ? "page" : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              {icons.intake}
            </span>
            <span>Intake</span>
          </Link>
          <Link
            className={`${styles.navItem} ${activeNav === "assignments" ? styles.navItemActive : ""}`}
            href="/assignments"
            aria-current={activeNav === "assignments" ? "page" : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              {icons.assignments}
            </span>
            <span>Assignments</span>
          </Link>
          <Link
            className={`${styles.navItem} ${activeNav === "courses" ? styles.navItemActive : ""}`}
            href="/courses"
            aria-current={activeNav === "courses" ? "page" : undefined}
          >
            <span className={styles.navIcon} aria-hidden="true">
              {icons.courses}
            </span>
            <span>4 Year Plan</span>
          </Link>
          <div className={styles.sidebarFooter}>
            Capture once. Use everywhere.
          </div>
        </aside>
        <main className={styles.main}>
          <div className={styles.content}>{children}</div>
        </main>
      </div>
    </div>
  );
}

interface WorkspaceHeaderProps {
  dateLabel: string;
  title?: string;
  summary: ReactNode;
  syncState: AssignmentSyncState;
  syncLabel: string;
  syncActionLabel?: string;
  icons: Pick<AssignmentUiIcons, "calendar" | "sync">;
  onSync: () => void;
}

export function WorkspaceHeader({
  dateLabel,
  title = "Good morning, Aydin",
  summary,
  syncState,
  syncLabel,
  icons,
  onSync,
}: WorkspaceHeaderProps) {
  const displayedSyncLabel =
    syncState === "syncing"
      ? "Syncing with Airtable..."
      : syncState === "error"
        ? "Sync failed"
        : syncLabel;
  const syncButtonLabel =
    syncState === "syncing"
      ? "Syncing with Airtable"
      : syncState === "error"
        ? "Retry Airtable sync"
        : "Sync with Airtable";

  return (
    <header className={styles.workspaceHeader}>
      <div>
        <p className={styles.dateLine}>
          <span className={styles.dateIcon} aria-hidden="true">
            {icons.calendar}
          </span>
          {dateLabel}
        </p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.summary}>{summary}</p>
      </div>
      <div className={styles.syncControl}>
        <span className={styles.syncStatus} aria-live="polite">
          <span className={styles.syncDot} data-state={syncState} aria-hidden="true" />
          <span className={styles.syncStatusText}>{displayedSyncLabel}</span>
        </span>
        <button
          className={styles.syncButton}
          type="button"
          onClick={onSync}
          disabled={syncState === "syncing"}
          aria-label={syncButtonLabel}
          title={syncButtonLabel}
        >
          <span
            className={styles.buttonIcon}
            data-spinning={syncState === "syncing"}
            aria-hidden="true"
          >
            {icons.sync}
          </span>
        </button>
      </div>
    </header>
  );
}

interface MobileViewSwitcherProps {
  value: AssignmentMobileView;
  icons: Pick<AssignmentUiIcons, "list" | "calendar">;
  onChange: (view: AssignmentMobileView) => void;
}

export function MobileViewSwitcher({ value, icons, onChange }: MobileViewSwitcherProps) {
  return (
    <div className={styles.mobileSwitcher} role="tablist" aria-label="Assignment view">
      <button
        className={styles.segmentButton}
        type="button"
        role="tab"
        aria-selected={value === "list"}
        data-active={value === "list"}
        onClick={() => onChange("list")}
      >
        <span className={styles.buttonIcon} aria-hidden="true">
          {icons.list}
        </span>
        List
      </button>
      <button
        className={styles.segmentButton}
        type="button"
        role="tab"
        aria-selected={value === "calendar"}
        data-active={value === "calendar"}
        onClick={() => onChange("calendar")}
      >
        <span className={styles.buttonIcon} aria-hidden="true">
          {icons.calendar}
        </span>
        Calendar
      </button>
    </div>
  );
}

interface WorkspaceGridProps {
  mobileView: AssignmentMobileView;
  assignmentPanel: ReactNode;
  calendarPanel: ReactNode;
}

export function WorkspaceGrid({ mobileView, assignmentPanel, calendarPanel }: WorkspaceGridProps) {
  return (
    <div className={styles.workspaceGrid}>
      <div className={mobileView === "calendar" ? styles.mobileHidden : undefined}>{assignmentPanel}</div>
      <div className={mobileView === "list" ? styles.mobileHidden : undefined}>{calendarPanel}</div>
    </div>
  );
}

interface WorkspaceNoticeProps {
  children: ReactNode;
  dismissLabel?: string;
  dismissIcon: ReactNode;
  onDismiss: () => void;
}

export function WorkspaceNotice({
  children,
  dismissLabel = "Dismiss message",
  dismissIcon,
  onDismiss,
}: WorkspaceNoticeProps) {
  return (
    <div className={styles.notice} role="alert">
      <span>{children}</span>
      <button className={styles.noticeDismiss} type="button" aria-label={dismissLabel} onClick={onDismiss}>
        <span className={styles.buttonIcon} aria-hidden="true">
          {dismissIcon}
        </span>
      </button>
    </div>
  );
}

interface AssignmentPanelProps {
  items: AssignmentListItem[];
  courses: CourseFilterOption[];
  selectedCourseId: string;
  hideCompleted: boolean;
  loading?: boolean;
  error?: string;
  icons: Pick<AssignmentUiIcons, "filter" | "edit" | "empty" | "error" | "sync">;
  onCourseChange: (courseId: string) => void;
  onHideCompletedChange: (hideCompleted: boolean) => void;
  onCompletionChange: (assignmentId: string, completed: boolean) => void;
  onEdit: (assignmentId: string) => void;
  onRetry: () => void;
}

export function AssignmentPanel({
  items,
  courses,
  selectedCourseId,
  hideCompleted,
  loading = false,
  error,
  icons,
  onCourseChange,
  onHideCompletedChange,
  onCompletionChange,
  onEdit,
  onRetry,
}: AssignmentPanelProps) {
  const filterMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeOnOutsideInteraction = (event: PointerEvent) => {
      if (
        filterMenuRef.current?.open &&
        event.target instanceof Node &&
        !filterMenuRef.current.contains(event.target)
      ) {
        filterMenuRef.current.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") filterMenuRef.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideInteraction);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <section className={styles.panel} aria-labelledby="upcoming-assignments-title">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle} id="upcoming-assignments-title">
          Upcoming assignments
        </h2>
        <div className={styles.panelTools}>
          <label className={styles.toggleLabel}>
            <input
              className={styles.toggle}
              type="checkbox"
              checked={hideCompleted}
              onChange={(event) => onHideCompletedChange(event.currentTarget.checked)}
            />
            Hide completed
          </label>
          <details className={styles.filterMenu} ref={filterMenuRef}>
            <summary
              className={styles.filterButton}
              aria-label={`Filter assignments by course. Current filter: ${
                selectedCourseId === "all"
                  ? "All courses"
                  : courses.find((course) => course.id === selectedCourseId)?.label ?? "Selected course"
              }`}
              title="Filter by course"
            >
              <span className={styles.buttonIcon} aria-hidden="true">
                {icons.filter}
              </span>
              {selectedCourseId !== "all" ? <span className={styles.filterActiveDot} aria-hidden="true" /> : null}
            </summary>
            <div className={styles.filterPopover} role="radiogroup" aria-label="Course filter">
              <p className={styles.filterHeading}>Filter by course</p>
              {[{ id: "all", label: "All courses" }, ...courses].map((course) => {
                const selected = selectedCourseId === course.id;
                return (
                  <button
                    className={styles.filterOption}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-selected={selected}
                    key={course.id}
                    onClick={(event) => {
                      onCourseChange(course.id);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                  >
                    <span className={styles.filterRadio} aria-hidden="true" />
                    <span>{course.label}</span>
                  </button>
                );
              })}
            </div>
          </details>
        </div>
      </div>
      {loading ? <AssignmentListSkeleton /> : null}
      {!loading && error ? (
        <AssignmentState
          icon={icons.error}
          title="Assignments could not be loaded"
          copy={error}
          actionLabel="Try again"
          actionIcon={icons.sync}
          onAction={onRetry}
        />
      ) : null}
      {!loading && !error && items.length === 0 ? (
        <AssignmentState
          icon={icons.empty}
          title="No assignments to show"
          copy={
            hideCompleted
              ? "There is no active work in this view. Reveal completed assignments or choose another course."
              : "Assignments added in Airtable will appear here."
          }
        />
      ) : null}
      {!loading && !error && items.length > 0 ? (
        <>
          <div className={styles.assignmentList}>
            {items.map((item) => (
              <AssignmentRow
                key={item.id}
                item={item}
                editIcon={icons.edit}
                onCompletionChange={onCompletionChange}
                onEdit={onEdit}
              />
            ))}
          </div>
          <div className={styles.panelFooter}>
            {items.length} {items.length === 1 ? "assignment" : "assignments"} in this view
          </div>
        </>
      ) : null}
    </section>
  );
}

interface AssignmentRowProps {
  item: AssignmentListItem;
  editIcon: ReactNode;
  onCompletionChange: (assignmentId: string, completed: boolean) => void;
  onEdit: (assignmentId: string) => void;
}

export function AssignmentRow({ item, editIcon, onCompletionChange, onEdit }: AssignmentRowProps) {
  const courseColor = { "--course-color": item.courseColor } as CSSProperties;

  return (
    <div
      className={styles.assignmentRow}
      data-assignment-id={item.id}
      data-completed={item.completed}
      data-saving={item.saving === true}
      data-feedback={item.completionFeedback}
      style={courseColor}
    >
      <input
        className={styles.completionBox}
        type="checkbox"
        checked={item.completed}
        disabled={item.saving || item.completionFeedback !== undefined}
        aria-label={`Mark ${item.title} ${item.completed ? "incomplete" : "complete"}`}
        onChange={(event) => onCompletionChange(item.id, event.currentTarget.checked)}
      />
      <div className={styles.assignmentMain}>
        <span className={styles.assignmentTitle} title={item.title}>
          {item.title}
        </span>
        <span className={styles.courseLine}>
          <span className={styles.courseDot} aria-hidden="true" />
          <span className={styles.courseName} title={item.courseName}>
            {item.courseName}
          </span>
          {item.saving ? (
            <span className={styles.savingLabel} role="status">Saving...</span>
          ) : item.completionFeedback ? (
            <span className={styles.completedLabel} role="status">Completed</span>
          ) : null}
        </span>
      </div>
      <div className={styles.dueBlock}>
        <span className={styles.dueLabel} data-tone={item.dueTone}>
          {item.dueLabel}
        </span>
        {item.dueExact ? <span className={styles.dueExact}>{item.dueExact}</span> : null}
      </div>
      <button
        className={styles.rowEditButton}
        type="button"
        aria-label={`Edit ${item.title}`}
        title="Edit assignment"
        disabled={item.saving || item.completionFeedback !== undefined}
        onClick={() => onEdit(item.id)}
      >
        <span className={styles.buttonIcon} aria-hidden="true">{editIcon}</span>
      </button>
    </div>
  );
}

interface CalendarPanelProps {
  monthLabel: string;
  days: AssignmentCalendarDay[];
  loading?: boolean;
  error?: string;
  icons: Pick<AssignmentUiIcons, "previous" | "next" | "today" | "empty" | "error" | "sync">;
  isCurrentMonth: boolean;
  selectedDateKey?: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDateSelect: (day: AssignmentCalendarDay) => void;
  onRetry: () => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function CalendarPanel({
  monthLabel,
  days,
  loading = false,
  error,
  icons,
  isCurrentMonth,
  selectedDateKey,
  onPreviousMonth,
  onNextMonth,
  onToday,
  onDateSelect,
  onRetry,
}: CalendarPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="assignment-calendar-title">
      <div className={styles.calendarHeader}>
        <h2 className={styles.calendarTitle} id="assignment-calendar-title" aria-live="polite">
          {monthLabel}
        </h2>
        <div className={styles.calendarNav}>
          <button className={styles.calendarNavButton} type="button" aria-label="Previous month" onClick={onPreviousMonth}>
            <span className={styles.buttonIcon} aria-hidden="true">{icons.previous}</span>
          </button>
          <button className={styles.calendarNavButton} type="button" aria-label="Next month" onClick={onNextMonth}>
            <span className={styles.buttonIcon} aria-hidden="true">{icons.next}</span>
          </button>
        </div>
      </div>
      {loading ? <CalendarSkeleton /> : null}
      {!loading && error ? (
        <AssignmentState
          icon={icons.error}
          title="Calendar could not be shown"
          copy={error}
          actionLabel="Try again"
          actionIcon={icons.sync}
          onAction={onRetry}
        />
      ) : null}
      {!loading && !error && days.length === 0 ? (
        <AssignmentState
          icon={icons.empty}
          title="No calendar dates"
          copy="Once assignments have due dates, they will appear on the calendar."
        />
      ) : null}
      {!loading && !error && days.length > 0 ? (
        <>
          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span className={styles.weekday} key={weekday}>
                {weekday}
              </span>
            ))}
          </div>
          <div className={styles.calendarGrid} role="grid" aria-label={monthLabel}>
            {days.map((day) => (
              <CalendarDay
                key={day.key}
                day={day}
                selected={selectedDateKey === day.key}
                onSelect={onDateSelect}
              />
            ))}
          </div>
          {!isCurrentMonth ? (
            <button className={styles.calendarTodayButton} type="button" onClick={onToday}>
              <span className={styles.buttonIcon} aria-hidden="true">{icons.today}</span>
              Back to today
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

interface CalendarDayProps {
  day: AssignmentCalendarDay;
  selected: boolean;
  onSelect: (day: AssignmentCalendarDay) => void;
}

function CalendarDay({ day, selected, onSelect }: CalendarDayProps) {
  return (
    <button
      className={styles.calendarCell}
      role="gridcell"
      type="button"
      aria-label={day.accessibleLabel}
      aria-pressed={selected}
      data-outside={day.isOutsideMonth}
      data-selected={selected}
      onClick={() => onSelect(day)}
    >
      <span className={styles.dayNumber} data-today={day.isToday}>
        {day.dayNumber}
      </span>
      <div className={styles.calendarEntries}>
        {day.entries.slice(0, 3).map((entry) => (
          <span
            className={styles.calendarEntryDot}
            key={entry.id}
            data-completed={entry.completed}
            style={{ "--course-color": entry.courseColor } as CSSProperties}
            aria-hidden="true"
          />
        ))}
      </div>
    </button>
  );
}

interface MobileAssignmentDetailProps {
  item?: AssignmentListItem;
  closeIcon: ReactNode;
  onClose: () => void;
  onCompletionChange: (assignmentId: string, completed: boolean) => void;
}

export function MobileAssignmentDetail({
  item,
  closeIcon,
  onClose,
  onCompletionChange,
}: MobileAssignmentDetailProps) {
  if (!item) return null;

  return (
    <div className={styles.detailBackdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.detailSheet}
        data-feedback={item.completionFeedback}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-assignment-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.detailHeader}>
          <div>
            <h2 className={styles.detailTitle} id="mobile-assignment-title">
              {item.title}
            </h2>
            <p className={`${styles.courseLine} ${styles.detailCourse}`}>
              <span
                className={styles.courseDot}
                style={{ "--course-color": item.courseColor } as CSSProperties}
                aria-hidden="true"
              />
              {item.courseName}
            </p>
          </div>
          <button className={styles.iconButton} type="button" aria-label="Close assignment details" onClick={onClose}>
            <span className={styles.buttonIcon} aria-hidden="true">
              {closeIcon}
            </span>
          </button>
        </div>
        <div className={styles.detailDue}>
          <span className={styles.dueLabel} data-tone={item.dueTone}>
            {item.dueLabel}
          </span>
          {item.dueExact ? <span className={styles.dueExact}>{item.dueExact}</span> : null}
        </div>
        <label className={styles.detailCompletion}>
          <input
            className={styles.completionBox}
            type="checkbox"
            checked={item.completed}
            disabled={item.saving || item.completionFeedback !== undefined}
            onChange={(event) => onCompletionChange(item.id, event.currentTarget.checked)}
          />
          {item.saving
            ? "Saving..."
            : item.completionFeedback
              ? "Completed"
              : item.completed
                ? "Mark as incomplete"
                : "Mark as complete"}
        </label>
      </section>
    </div>
  );
}

interface AssignmentStateProps {
  icon: ReactNode;
  title: string;
  copy: string;
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
}

export function AssignmentState({
  icon,
  title,
  copy,
  actionLabel,
  actionIcon,
  onAction,
}: AssignmentStateProps) {
  return (
    <div className={styles.state}>
      <div className={styles.stateInner}>
        <span className={styles.stateIcon} aria-hidden="true">
          {icon}
        </span>
        <h3 className={styles.stateTitle}>{title}</h3>
        <p className={styles.stateCopy}>{copy}</p>
        {actionLabel && onAction ? (
          <button className={styles.retryButton} type="button" onClick={onAction}>
            {actionIcon ? (
              <span className={styles.buttonIcon} aria-hidden="true">
                {actionIcon}
              </span>
            ) : null}
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AssignmentListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.skeletonList} aria-label="Loading assignments" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <div className={styles.skeletonRow} key={index}>
          <span className={styles.skeletonBox} />
          <span className={styles.skeletonText}>
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonShort} />
          </span>
          <span className={styles.skeletonShort} />
        </div>
      ))}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className={styles.calendarSkeleton} aria-label="Loading calendar" aria-busy="true">
      <div className={styles.stateInner}>
        <span className={styles.skeletonLine} />
        <span className={styles.skeletonShort} />
      </div>
    </div>
  );
}
