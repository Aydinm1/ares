"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Filter,
  Inbox,
  Layers3,
  List,
  ListTodo,
  LocateFixed,
  RefreshCw,
  X,
} from "lucide-react";
import { format } from "date-fns";
import {
  AssignmentPanel,
  AssignmentShell,
  CalendarPanel,
  MobileAssignmentDetail,
  MobileViewSwitcher,
  WorkspaceGrid,
  WorkspaceHeader,
  WorkspaceNotice,
  type AssignmentCalendarDay,
  type AssignmentCompletionFeedback,
  type AssignmentListItem,
  type AssignmentMobileView,
  type AssignmentSyncState,
  type AssignmentUiIcons,
} from "../assignment-ui";
import {
  beginCompletionChange,
  buildAssignmentRowViewModels,
  buildMonthGrid,
  commitCompletionChange,
  createOptimisticCompletionState,
  filterAssignments,
  formatLastSyncedLabel,
  groupAssignmentsByLocalDate,
  isSameLocalMonth,
  localDateKey,
  millisecondsUntilNextLocalDay,
  monthForToday,
  rollbackCompletionChange,
  shiftMonth,
  sortAssignments,
  type OptimisticCompletionState,
} from "../../src/assignments";
import {
  loadAssignments,
  loadCourses,
  updateAssignmentCompletion,
} from "../../src/app/apiClient";
import type { Assignment, Course } from "../../src/domain";

const icons: AssignmentUiIcons = {
  brand: <Layers3 size={22} strokeWidth={2.2} />,
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <BookOpen size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  list: <List size={17} strokeWidth={2} />,
  previous: <ChevronLeft size={18} strokeWidth={2} />,
  next: <ChevronRight size={18} strokeWidth={2} />,
  today: <LocateFixed size={16} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
  filter: <Filter size={17} strokeWidth={2} />,
  close: <X size={17} strokeWidth={2} />,
  empty: <Inbox size={19} strokeWidth={2} />,
  error: <CircleAlert size={19} strokeWidth={2} />,
};

const EMPTY_STATE = createOptimisticCompletionState([]);
const COMPLETION_CONFIRM_MS = 600;
const COMPLETION_EXIT_MS = 220;

export function AssignmentsWorkspace() {
  const [completionState, setCompletionState] = useState<OptimisticCompletionState>(EMPTY_STATE);
  const completionStateRef = useRef(completionState);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncState, setSyncState] = useState<AssignmentSyncState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [syncClock, setSyncClock] = useState(() => new Date());
  const hasLoadedRef = useRef(false);
  const [loadError, setLoadError] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [selectedCourseId, setSelectedCourseId] = useState("all");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [visibleMonth, setVisibleMonth] = useState(() => monthForToday());
  const [today, setToday] = useState(() => new Date());
  const todayRef = useRef(today);
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey(today));
  const [mobileView, setMobileView] = useState<AssignmentMobileView>("list");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>();
  const [completionFeedbackById, setCompletionFeedbackById] = useState<
    Readonly<Record<string, AssignmentCompletionFeedback | undefined>>
  >({});
  const completionFeedbackTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  const clearCompletionFeedback = useCallback((assignmentId: string) => {
    const timer = completionFeedbackTimersRef.current.get(assignmentId);
    if (timer) clearTimeout(timer);
    completionFeedbackTimersRef.current.delete(assignmentId);
    setCompletionFeedbackById((current) => {
      if (current[assignmentId] === undefined) return current;
      const next = { ...current };
      delete next[assignmentId];
      return next;
    });
  }, []);

  const scheduleCompletionFeedback = useCallback((assignmentId: string) => {
    clearCompletionFeedback(assignmentId);
    setCompletionFeedbackById((current) => ({
      ...current,
      [assignmentId]: "confirmed",
    }));

    const confirmationTimer = setTimeout(() => {
      setCompletionFeedbackById((current) => ({
        ...current,
        [assignmentId]: "exiting",
      }));
      const exitTimer = setTimeout(() => {
        completionFeedbackTimersRef.current.delete(assignmentId);
        setCompletionFeedbackById((current) => {
          const next = { ...current };
          delete next[assignmentId];
          return next;
        });
        setSelectedAssignmentId((selected) =>
          selected === assignmentId ? undefined : selected
        );
      }, COMPLETION_EXIT_MS);
      completionFeedbackTimersRef.current.set(assignmentId, exitTimer);
    }, COMPLETION_CONFIRM_MS);

    completionFeedbackTimersRef.current.set(assignmentId, confirmationTimer);
  }, [clearCompletionFeedback]);

  const replaceCompletionState = useCallback((next: OptimisticCompletionState) => {
    completionStateRef.current = next;
    setCompletionState(next);
  }, []);

  const loadWorkspace = useCallback(async () => {
    setSyncState("syncing");
    if (!hasLoadedRef.current) setLoadError(undefined);
    try {
      const [assignments, nextCourses] = await Promise.all([loadAssignments(), loadCourses()]);
      replaceCompletionState(createOptimisticCompletionState(assignments));
      setCourses(nextCourses);
      hasLoadedRef.current = true;
      const syncedAt = new Date();
      setLastSyncedAt(syncedAt);
      setSyncClock(syncedAt);
      setLoadError(undefined);
      setSyncState("synced");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Airtable data is unavailable.";
      if (hasLoadedRef.current) {
        setMutationError(`Airtable refresh failed: ${message}`);
      } else {
        setLoadError(message);
      }
      setSyncState("error");
    } finally {
      setLoading(false);
    }
  }, [replaceCompletionState]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(
    () => () => {
      for (const timer of completionFeedbackTimersRef.current.values()) {
        clearTimeout(timer);
      }
      completionFeedbackTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setSyncClock(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const refreshLocalDate = useCallback(() => {
    const nextToday = new Date();
    const previousToday = todayRef.current;
    todayRef.current = nextToday;
    setToday(nextToday);
    setSelectedDateKey((selected) =>
      selected === localDateKey(previousToday) ? localDateKey(nextToday) : selected
    );
    setVisibleMonth((month) =>
      isSameLocalMonth(month, previousToday) ? monthForToday(nextToday) : month
    );
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const scheduleMidnightRefresh = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        refreshLocalDate();
        scheduleMidnightRefresh();
      }, millisecondsUntilNextLocalDay());
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") refreshLocalDate();
    };
    scheduleMidnightRefresh();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", refreshLocalDate);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", refreshLocalDate);
    };
  }, [refreshLocalDate]);

  const retainedCompletedIds = useMemo(
    () =>
      new Set([
        ...Object.keys(completionState.pending),
        ...Object.keys(completionFeedbackById),
      ]),
    [completionFeedbackById, completionState.pending],
  );
  const inProgressCourseIds = useMemo(
    () =>
      new Set(
        courses
          .filter((course) => course.status === "in_progress")
          .map((course) => course.id),
      ),
    [courses],
  );

  const visibleAssignments = useMemo(
    () =>
      sortAssignments(
        filterAssignments(completionState.assignments, {
          courseId: selectedCourseId,
          hideCompleted,
          completedCourseIds: inProgressCourseIds,
          retainedCompletedIds,
        }),
        courses,
        { completedFirst: !hideCompleted },
      ),
    [
      completionState.assignments,
      courses,
      hideCompleted,
      inProgressCourseIds,
      retainedCompletedIds,
      selectedCourseId,
    ],
  );

  const rowItems = useMemo(
    () =>
      toListItems(
        visibleAssignments,
        courses,
        completionState,
        completionFeedbackById,
        today,
      ),
    [completionFeedbackById, completionState, courses, today, visibleAssignments],
  );
  const rowItemById = useMemo(() => new Map(rowItems.map((item) => [item.id, item])), [rowItems]);
  const calendarDays = useMemo(
    () => toCalendarDays(visibleMonth, visibleAssignments, rowItemById, today),
    [rowItemById, today, visibleAssignments, visibleMonth],
  );
  const courseOptions = useMemo(
    () =>
      [...courses]
        .filter((course) => course.status === "in_progress")
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((course) => ({ id: course.id, label: course.name })),
    [courses],
  );
  const selectedItem = selectedAssignmentId ? rowItemById.get(selectedAssignmentId) : undefined;
  const activeCount = completionState.assignments.filter(
    (assignment) => assignment.status !== "submitted",
  ).length;

  const handleCompletionChange = useCallback(
    async (assignmentId: string, completed: boolean) => {
      setMutationError(undefined);
      if (!completed) clearCompletionFeedback(assignmentId);
      let change;
      try {
        change = beginCompletionChange(completionStateRef.current, assignmentId, completed);
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : "This assignment could not be updated.");
        return;
      }

      replaceCompletionState(change.state);
      try {
        const serverAssignment = await updateAssignmentCompletion(assignmentId, completed);
        if (completed) scheduleCompletionFeedback(assignmentId);
        replaceCompletionState(
          commitCompletionChange(completionStateRef.current, change.mutation, serverAssignment),
        );
        const syncedAt = new Date();
        setLastSyncedAt(syncedAt);
        setSyncClock(syncedAt);
        setSyncState("synced");
      } catch (error) {
        clearCompletionFeedback(assignmentId);
        replaceCompletionState(rollbackCompletionChange(completionStateRef.current, change.mutation));
        setMutationError(
          error instanceof Error
            ? `Completion was not saved: ${error.message}`
            : "Completion was not saved. The previous state was restored.",
        );
      }
    },
    [clearCompletionFeedback, replaceCompletionState, scheduleCompletionFeedback],
  );

  const handleEntrySelect = useCallback((item: AssignmentListItem) => {
    setSelectedAssignmentId(item.id);
  }, []);

  const formattedToday = format(today, "EEEE, MMMM d, yyyy");
  const syncLabel =
    syncState === "syncing"
      ? "Syncing..."
      : syncState === "error"
        ? "Sync failed"
        : lastSyncedAt
          ? formatLastSyncedLabel(lastSyncedAt, syncClock)
          : "Not synced";

  return (
    <AssignmentShell
      activeNav="assignments"
      icons={{ brand: icons.brand, assignments: icons.assignments, courses: icons.courses }}
    >
      <WorkspaceHeader
        dateLabel={formattedToday}
        summary={
          <>
            You have <strong>{activeCount} active assignments</strong>.
          </>
        }
        syncState={syncState}
        syncLabel={syncLabel}
        syncActionLabel={syncState === "syncing" ? "Syncing" : "Sync now"}
        icons={{ calendar: icons.calendar, sync: icons.sync }}
        onSync={() => void loadWorkspace()}
      />

      {mutationError ? (
        <WorkspaceNotice dismissIcon={icons.close} onDismiss={() => setMutationError(undefined)}>
          {mutationError}
        </WorkspaceNotice>
      ) : null}

      <MobileViewSwitcher
        value={mobileView}
        icons={{ list: icons.list, calendar: icons.calendar }}
        onChange={setMobileView}
      />

      <WorkspaceGrid
        mobileView={mobileView}
        assignmentPanel={
          <AssignmentPanel
            items={rowItems}
            courses={courseOptions}
            selectedCourseId={selectedCourseId}
            hideCompleted={hideCompleted}
            loading={loading}
            error={loadError}
            icons={{
              filter: icons.filter,
              empty: icons.empty,
              error: icons.error,
              sync: icons.sync,
            }}
            onCourseChange={setSelectedCourseId}
            onHideCompletedChange={setHideCompleted}
            onCompletionChange={(id, completed) => void handleCompletionChange(id, completed)}
            onRetry={() => void loadWorkspace()}
          />
        }
        calendarPanel={
          <CalendarPanel
            monthLabel={format(visibleMonth, "MMMM yyyy")}
            days={calendarDays}
            loading={loading}
            error={loadError}
            isCurrentMonth={isSameLocalMonth(visibleMonth, today)}
            selectedDateKey={selectedDateKey}
            icons={{
              previous: icons.previous,
              next: icons.next,
              today: icons.today,
              empty: icons.empty,
              error: icons.error,
              sync: icons.sync,
            }}
            onPreviousMonth={() => setVisibleMonth((month) => shiftMonth(month, -1))}
            onNextMonth={() => setVisibleMonth((month) => shiftMonth(month, 1))}
            onToday={() => {
              setVisibleMonth(monthForToday(today));
              setSelectedDateKey(localDateKey(today));
            }}
            onDateSelect={(day) => {
              setSelectedDateKey(day.key);
              const firstItem = day.entries[0]?.item;
              if (firstItem) handleEntrySelect(firstItem);
            }}
            onRetry={() => void loadWorkspace()}
          />
        }
      />

      <MobileAssignmentDetail
        item={selectedItem}
        closeIcon={icons.close}
        onClose={() => setSelectedAssignmentId(undefined)}
        onCompletionChange={(id, completed) => void handleCompletionChange(id, completed)}
      />
    </AssignmentShell>
  );
}

function toListItems(
  assignments: readonly Assignment[],
  courses: readonly Course[],
  completionState: OptimisticCompletionState,
  completionFeedbackById: Readonly<
    Record<string, AssignmentCompletionFeedback | undefined>
  >,
  now: Date,
): AssignmentListItem[] {
  return buildAssignmentRowViewModels(assignments, courses, now).map((viewModel) => ({
    id: viewModel.assignment.id,
    title: viewModel.assignment.title,
    courseName: viewModel.course?.name ?? "Course not linked",
    courseColor: viewModel.courseColor,
    dueLabel: viewModel.dueLabel,
    dueExact: formatDeadline(viewModel.assignment.dueAt),
    dueTone: viewModel.dueTone,
    completed: viewModel.completed,
    saving: completionState.pending[viewModel.assignment.id] !== undefined,
    completionFeedback: completionFeedbackById[viewModel.assignment.id],
  }));
}

function toCalendarDays(
  month: Date,
  assignments: readonly Assignment[],
  rowItemById: ReadonlyMap<string, AssignmentListItem>,
  today: Date,
): AssignmentCalendarDay[] {
  const assignmentsByDate = groupAssignmentsByLocalDate(assignments);
  return buildMonthGrid(month, today).map((day) => {
    const assignmentsForDay = assignmentsByDate[day.dateKey] ?? [];
    const visibleEntries = assignmentsForDay.flatMap((assignment) => {
      const item = rowItemById.get(assignment.id);
      return item
        ? [
            {
              id: assignment.id,
              title: assignment.title,
              courseColor: item.courseColor,
              completed: item.completed,
              item,
            },
          ]
        : [];
    });
    return {
      key: day.dateKey,
      dayNumber: day.dayOfMonth,
      accessibleLabel: format(day.date, "EEEE, MMMM d, yyyy"),
      isToday: day.isToday,
      isOutsideMonth: !day.inMonth,
      entries: visibleEntries,
    };
  });
}

function formatDeadline(dueAt: string | undefined): string | undefined {
  if (!dueAt) return undefined;
  const due = new Date(dueAt);
  return Number.isNaN(due.getTime()) ? undefined : format(due, "MMM d, yyyy · h:mm a");
}
