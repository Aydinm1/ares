"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheckBig,
  Filter,
  Eye,
  EyeOff,
  Inbox,
  List,
  ListTodo,
  LocateFixed,
  GraduationCap,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { format } from "date-fns";
import {
  AssignmentPanel,
  AssignmentShell,
  CalendarPanel,
  MobileViewSwitcher,
  WorkspaceGrid,
  WorkspaceHeader,
  WorkspaceNotice,
  type AssignmentCalendarDay,
  type AssignmentListItem,
  type AssignmentMobileView,
  type AssignmentSyncState,
  type AssignmentUiIcons,
} from "../assignment-ui";
import {
  beginCompletionChange,
  beginAssignmentChange,
  buildAssignmentRowViewModels,
  buildMonthGrid,
  commitCompletionChange,
  createOptimisticCompletionState,
  filterAssignments,
  formatAssignmentDeadline,
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
  updateAssignmentDetails,
  updateAssignmentVisibility,
  type AssignmentEditorUpdate,
} from "../../src/app/apiClient";
import type { Assignment, Course } from "../../src/domain";
import {
  AssignmentEditorDrawer,
  type AssignmentDrawerState,
} from "./AssignmentEditorDrawer";

const icons: AssignmentUiIcons = {
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  intake: <Inbox size={19} strokeWidth={2} />,
  habits: <CircleCheckBig size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  list: <List size={17} strokeWidth={2} />,
  previous: <ChevronLeft size={18} strokeWidth={2} />,
  next: <ChevronRight size={18} strokeWidth={2} />,
  today: <LocateFixed size={16} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
  filter: <Filter size={17} strokeWidth={2} />,
  edit: <Pencil size={15} strokeWidth={2} />,
  show: <Eye size={15} strokeWidth={2} />,
  hide: <EyeOff size={15} strokeWidth={2} />,
  close: <X size={17} strokeWidth={2} />,
  empty: <Inbox size={19} strokeWidth={2} />,
  error: <CircleAlert size={19} strokeWidth={2} />,
};

const EMPTY_STATE = createOptimisticCompletionState([]);

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
  const [showHidden, setShowHidden] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthForToday());
  const [today, setToday] = useState(() => new Date());
  const todayRef = useRef(today);
  const [selectedDateKey, setSelectedDateKey] = useState(() => localDateKey(today));
  const [mobileView, setMobileView] = useState<AssignmentMobileView>("list");
  const [drawerState, setDrawerState] = useState<AssignmentDrawerState>();
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string>();

  const replaceCompletionState = useCallback((next: OptimisticCompletionState) => {
    completionStateRef.current = next;
    setCompletionState(next);
  }, []);

  const loadWorkspace = useCallback(async (options: { refresh?: boolean } = {}) => {
    setSyncState("syncing");
    if (!hasLoadedRef.current) setLoadError(undefined);
    try {
      const [assignments, nextCourses] = await Promise.all([
        loadAssignments(options),
        loadCourses(options),
      ]);
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
    () => new Set<string>(),
    [],
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

  const visibleListAssignments = useMemo(
    () =>
      sortAssignments(
        filterAssignments(completionState.assignments, {
          courseId: selectedCourseId,
          hideCompleted,
          hideHiddenFromList: !showHidden,
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
      showHidden,
    ],
  );

  const visibleCalendarAssignments = useMemo(
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
        visibleListAssignments,
        courses,
        today,
      ),
    [courses, today, visibleListAssignments],
  );
  const calendarItems = useMemo(
    () =>
      toListItems(
        visibleCalendarAssignments,
        courses,
        today,
      ),
    [courses, today, visibleCalendarAssignments],
  );
  const calendarItemById = useMemo(
    () => new Map(calendarItems.map((item) => [item.id, item])),
    [calendarItems],
  );
  const calendarDays = useMemo(
    () => toCalendarDays(visibleMonth, visibleCalendarAssignments, calendarItemById, today),
    [calendarItemById, today, visibleCalendarAssignments, visibleMonth],
  );
  const courseOptions = useMemo(
    () =>
      [...courses]
        .filter((course) => course.status === "in_progress")
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((course) => ({ id: course.id, label: course.name })),
    [courses],
  );
  const assignmentById = useMemo(
    () => new Map(completionState.assignments.map((assignment) => [assignment.id, assignment])),
    [completionState.assignments],
  );
  const selectedAssignment =
    drawerState?.kind === "editor" ? assignmentById.get(drawerState.assignmentId) : undefined;
  const agendaDay =
    drawerState?.kind === "agenda"
      ? calendarDays.find((day) => day.key === drawerState.dateKey)
      : undefined;
  const activeCount = completionState.assignments.filter(
    (assignment) => assignment.status !== "submitted" && assignment.hiddenFromList !== true,
  ).length;

  const handleCompletionChange = useCallback(
    async (assignmentId: string, completed: boolean) => {
      setMutationError(undefined);
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
        replaceCompletionState(
          commitCompletionChange(completionStateRef.current, change.mutation, serverAssignment),
        );
        const syncedAt = new Date();
        setLastSyncedAt(syncedAt);
        setSyncClock(syncedAt);
        setSyncState("synced");
      } catch (error) {
        replaceCompletionState(rollbackCompletionChange(completionStateRef.current, change.mutation));
        setMutationError(
          error instanceof Error
            ? `Completion was not saved: ${error.message}`
            : "Completion was not saved. The previous state was restored.",
        );
      }
    },
    [replaceCompletionState],
  );

  const handleHiddenChange = useCallback(
    async (assignmentId: string, hiddenFromList: boolean) => {
      setMutationError(undefined);
      let change;
      try {
        change = beginAssignmentChange(completionStateRef.current, assignmentId, { hiddenFromList });
      } catch (error) {
        setMutationError(error instanceof Error ? error.message : "This assignment could not be updated.");
        return;
      }

      replaceCompletionState(change.state);
      try {
        const serverAssignment = await updateAssignmentVisibility(assignmentId, hiddenFromList);
        replaceCompletionState(
          commitCompletionChange(completionStateRef.current, change.mutation, serverAssignment),
        );
        const syncedAt = new Date();
        setLastSyncedAt(syncedAt);
        setSyncClock(syncedAt);
        setSyncState("synced");
      } catch (error) {
        replaceCompletionState(rollbackCompletionChange(completionStateRef.current, change.mutation));
        setMutationError(
          error instanceof Error
            ? `Assignment visibility was not saved: ${error.message}`
            : "Assignment visibility was not saved. The previous state was restored.",
        );
      }
    },
    [replaceCompletionState],
  );

  const handleEntrySelect = useCallback((assignmentId: string, returnDateKey?: string) => {
    setEditorError(undefined);
    setDrawerState({ kind: "editor", assignmentId, returnDateKey });
  }, []);

  const handleAssignmentSave = useCallback(
    async (assignmentId: string, update: AssignmentEditorUpdate) => {
      setEditorSaving(true);
      setEditorError(undefined);
      try {
        const serverAssignment = await updateAssignmentDetails(assignmentId, update);
        const current = completionStateRef.current;
        replaceCompletionState({
          ...current,
          assignments: current.assignments.map((assignment) =>
            assignment.id === assignmentId ? serverAssignment : assignment
          ),
        });
        const syncedAt = new Date();
        setLastSyncedAt(syncedAt);
        setSyncClock(syncedAt);
        setSyncState("synced");
        setDrawerState(undefined);
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : "Assignment changes could not be saved.");
      } finally {
        setEditorSaving(false);
      }
    },
    [replaceCompletionState],
  );

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
      icons={{
        assignments: icons.assignments,
        courses: icons.courses,
        intake: icons.intake,
        habits: icons.habits,
      }}
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
        onSync={() => void loadWorkspace({ refresh: true })}
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
            showHidden={showHidden}
            loading={loading}
            error={loadError}
            icons={{
              filter: icons.filter,
              edit: icons.edit,
              show: icons.show,
              hide: icons.hide,
              empty: icons.empty,
              error: icons.error,
              sync: icons.sync,
            }}
            onCourseChange={setSelectedCourseId}
            onHideCompletedChange={setHideCompleted}
            onShowHiddenChange={setShowHidden}
            onCompletionChange={(id, completed) => void handleCompletionChange(id, completed)}
            onHiddenChange={(id, hiddenFromList) => void handleHiddenChange(id, hiddenFromList)}
            onEdit={handleEntrySelect}
            onRetry={() => void loadWorkspace({ refresh: true })}
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
              if (day.entries.length > 0) {
                setEditorError(undefined);
                setDrawerState({ kind: "agenda", dateKey: day.key });
              }
            }}
            onRetry={() => void loadWorkspace({ refresh: true })}
          />
        }
      />

      <AssignmentEditorDrawer
        state={drawerState}
        assignment={selectedAssignment}
        agendaDay={agendaDay}
        courses={courses}
        saving={editorSaving}
        saveError={editorError}
        onClose={() => {
          if (!editorSaving) setDrawerState(undefined);
        }}
        onEditAssignment={handleEntrySelect}
        onBackToAgenda={(dateKey) => {
          setEditorError(undefined);
          setDrawerState({ kind: "agenda", dateKey });
        }}
        onSave={handleAssignmentSave}
      />
    </AssignmentShell>
  );
}

function toListItems(
  assignments: readonly Assignment[],
  courses: readonly Course[],
  now: Date,
): AssignmentListItem[] {
  return buildAssignmentRowViewModels(assignments, courses, now).map((viewModel) => ({
    id: viewModel.assignment.id,
    title: viewModel.assignment.title,
    courseName: viewModel.course?.name ?? "Course not linked",
    courseColor: viewModel.courseColor,
    dueLabel: viewModel.dueLabel,
    dueExact: formatAssignmentDeadline(viewModel.assignment.dueAt),
    dueTone: viewModel.dueTone,
    completed: viewModel.completed,
    hiddenFromList: viewModel.assignment.hiddenFromList,
    saving: false,
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
