"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Layers3,
  ListTodo,
  RefreshCw,
  X,
} from "lucide-react";
import {
  AssignmentShell,
  WorkspaceHeader,
  type AssignmentSyncState,
} from "../assignment-ui";
import { loadCourses } from "../../src/app/apiClient";
import {
  ACADEMIC_YEARS,
  COURSE_HISTORY_QUARTERS,
  courseGradeLabel,
  coursesForAcademicYear,
  coursesForQuarter,
  quarterUnitTotal,
} from "../../src/courses";
import { formatLastSyncedLabel } from "../../src/assignments";
import type { Course } from "../../src/domain";
import styles from "./courses.module.css";

const icons = {
  brand: <Layers3 size={22} strokeWidth={2.2} />,
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <BookOpen size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
};

export function CoursesWorkspace() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [syncState, setSyncState] = useState<AssignmentSyncState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [clock, setClock] = useState(() => new Date());
  const [selectedCourse, setSelectedCourse] = useState<Course>();

  const loadHistory = useCallback(async () => {
    setSyncState("syncing");
    try {
      const nextCourses = await loadCourses();
      setCourses(nextCourses);
      const syncedAt = new Date();
      setLastSyncedAt(syncedAt);
      setClock(syncedAt);
      setError(undefined);
      setSyncState("synced");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Course history is unavailable.");
      setSyncState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const historyCourses = useMemo(
    () => ACADEMIC_YEARS.flatMap(({ quarters }) => coursesForAcademicYear(courses, quarters)),
    [courses],
  );
  const syncLabel =
    syncState === "syncing"
      ? "Syncing..."
      : syncState === "error"
        ? "Sync failed"
        : lastSyncedAt
          ? formatLastSyncedLabel(lastSyncedAt, clock)
          : "Not synced";

  return (
    <AssignmentShell activeNav="courses" icons={icons}>
      <WorkspaceHeader
        dateLabel="Academic history"
        title="4 Year Plan"
        summary={
          <>
            <strong>{historyCourses.length} planned courses</strong> across {COURSE_HISTORY_QUARTERS.length} quarters.
          </>
        }
        syncState={syncState}
        syncLabel={syncLabel}
        syncActionLabel={syncState === "syncing" ? "Syncing" : "Sync now"}
        icons={{ calendar: icons.calendar, sync: icons.sync }}
        onSync={() => void loadHistory()}
      />

      {loading ? <CourseHistorySkeleton /> : null}
      {!loading && error ? (
        <div className={styles.state}>
          <div>
            <h2>4 Year Plan could not be loaded</h2>
            <p>{error}</p>
            <button className={styles.retry} type="button" onClick={() => void loadHistory()}>
              Try again
            </button>
          </div>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className={styles.timeline}>
          {ACADEMIC_YEARS.map((year) => {
            const yearCourses = coursesForAcademicYear(courses, year.quarters);
            return (
              <section className={styles.year} aria-labelledby={`course-${year.label}`} key={year.label}>
                <div className={styles.yearLabel} id={`course-${year.label}`}>
                  {year.label}
                </div>
                <div
                  className={styles.quarterGrid}
                  style={{ gridTemplateColumns: `repeat(${year.quarters.length}, minmax(0, 1fr))` }}
                >
                  {year.quarters.map((quarter) => (
                    <Quarter
                      key={quarter}
                      quarter={quarter}
                      courses={coursesForQuarter(yearCourses, quarter)}
                      selectedCourse={selectedCourse}
                      onCourseSelect={(course) =>
                        setSelectedCourse((selected) => selected?.id === course.id ? undefined : course)
                      }
                      onDetailClose={() => setSelectedCourse(undefined)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </AssignmentShell>
  );
}

function Quarter({
  quarter,
  courses,
  selectedCourse,
  onCourseSelect,
  onDetailClose,
}: {
  quarter: string;
  courses: Course[];
  selectedCourse?: Course;
  onCourseSelect: (course: Course) => void;
  onDetailClose: () => void;
}) {
  return (
    <section className={styles.quarter} aria-label={quarter}>
      <header className={styles.quarterHeader}>
        <h2 className={styles.quarterTitle}>{quarter}</h2>
        <span className={styles.quarterMeta}>{courses.length} · {quarterUnitTotal(courses)}u</span>
      </header>
      {courses.length ? (
        <div className={styles.courseList}>
          {courses.map((course) => {
            const grade = courseGradeLabel(course);
            const selected = selectedCourse?.id === course.id;
            return (
              <div className={styles.courseItem} key={course.id}>
                <button
                  className={styles.courseButton}
                  type="button"
                  data-selected={selected}
                  aria-expanded={selected}
                  onClick={() => onCourseSelect(course)}
                >
                  <span className={styles.courseName} title={course.name}>{course.name}</span>
                  <span className={styles.units}>{course.creditHours ?? "—"}u</span>
                  <span className={styles.grade} data-progress={grade === "In progress"}>{grade}</span>
                </button>
                {selected ? <CourseDetail course={course} onClose={onDetailClose} /> : null}
              </div>
            );
          })}
        </div>
      ) : <div className={styles.emptyQuarter}>No courses recorded.</div>}
    </section>
  );
}

function CourseDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        detailRef.current &&
        !detailRef.current.contains(event.target)
      ) {
        onClose();
      }
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [onClose]);

  const grade = courseGradeLabel(course);
  return (
    <div className={styles.detailPopover} ref={detailRef} role="dialog" aria-label={`${course.name} details`}>
      <div className={styles.detailHeader}>
        <div>
          <h3 className={styles.detailTitle}>{course.name}</h3>
          <p className={styles.detailMeta}>
            {course.quarterTaken} · {course.creditHours ?? "—"} units · {grade}
          </p>
        </div>
        <button className={styles.closeButton} type="button" aria-label="Close course details" onClick={onClose}>
          <X size={17} />
        </button>
      </div>
      <div className={styles.requirements}>
        <p className={styles.requirementHeading}>Requirements</p>
        {course.geRequirementsUsed?.map((requirement) => (
          <span className={styles.tag} key={requirement.id}>{requirement.category}</span>
        ))}
        {course.majorRequirements?.map((requirement) => (
          <span className={`${styles.tag} ${styles.tagMajor}`} key={requirement}>
            Major · {requirement}
          </span>
        ))}
        {!course.geRequirementsUsed?.length && !course.majorRequirements?.length ? (
          <span className={styles.emptyRequirement}>No requirement recorded</span>
        ) : null}
      </div>
    </div>
  );
}

function CourseHistorySkeleton() {
  return (
    <div className={styles.loading} aria-label="Loading 4 Year Plan" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <div className={styles.skeleton} key={index} />)}
    </div>
  );
}
