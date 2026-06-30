"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Layers3,
  ListTodo,
  GraduationCap,
  RefreshCw,
  Sun,
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
  courseGpa,
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
  courses: <GraduationCap size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
};

type RequirementSymbolVariant =
  | "breadth"
  | "additional"
  | "cognitiveScience"
  | "computerScience"
  | "dualMajor"
  | "generalScience"
  | "cgsGroup"
  | "csElective"
  | "dualTrack";

interface RequirementSymbol {
  family: "breadth" | "additional" | "major" | "track";
  label: string;
  tooltip: string;
  variant: RequirementSymbolVariant;
}

const requirementVariantClasses: Record<RequirementSymbolVariant, string> = {
  breadth: styles.requirementMarkBreadth ?? "",
  additional: styles.requirementMarkAdditional ?? "",
  cognitiveScience: styles.requirementMarkCognitiveScience ?? "",
  computerScience: styles.requirementMarkComputerScience ?? "",
  dualMajor: styles.requirementMarkDualMajor ?? "",
  generalScience: styles.requirementMarkGeneralScience ?? "",
  cgsGroup: styles.requirementMarkCgsGroup ?? "",
  csElective: styles.requirementMarkCsElective ?? "",
  dualTrack: styles.requirementMarkDualTrack ?? "",
};

const breadthRequirements = new Map([
  ["Arts & Humanities (AH)", "AH"],
  ["Social Sciences (SS)", "SS"],
  ["Science & Engineering (SE)", "SE"],
]);

const additionalRequirements = new Map([
  ["Quantitative Literacy (QL)", "QL"],
  ["Writing Experience (WE)", "WE"],
  ["Scientific Literacy (SL)", "SL"],
  ["Visual Literacy (VL)", "VL"],
  ["World Cultures (WC)", "WC"],
  ["Domestic Diversity (DD)", "DD"],
  ["American Cultures, Gov & History (ACGH)", "ACGH"],
  ["Oral Literacy (OL)", "OL"],
  ["English Composition", "EC"],
]);

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
            Visualizing your path to graduation in Cognitive Science and Computer Science.
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
            const hasSummerQuarter = year.quarters.some((quarter) => quarter.startsWith("Summer"));
            const hasSelectedCourse = selectedCourse
              ? yearCourses.some((course) => course.id === selectedCourse.id)
              : false;
            return (
              <section
                className={styles.year}
                data-has-selection={hasSelectedCourse}
                aria-labelledby={`course-${year.label}`}
                key={year.label}
              >
                <div className={styles.yearHeader}>
                  <div className={styles.yearHeaderLeft}>
                    <span className={styles.yearLabel} id={`course-${year.label}`}>
                      {year.label}
                    </span>
                    <span className={styles.yearDivider} aria-hidden="true" />
                    <span className={styles.yearRange}>{formatAcademicYearRange(year.quarters)}</span>
                  </div>
                  <div className={styles.yearUnits}>
                    <p>{quarterUnitTotal(yearCourses)} Total Units</p>
                    <strong>GPA: {formatGpa(yearCourses)}</strong>
                  </div>
                </div>
                <div className={styles.quarterGrid}>
                  {year.quarters.map((quarter) => (
                    <Quarter
                      key={quarter}
                      quarter={quarter}
                      courses={coursesForQuarter(yearCourses, quarter)}
                      selectedCourse={selectedCourse}
                      onCourseSelect={(course) =>
                        setSelectedCourse((selected) => (selected?.id === course.id ? undefined : course))
                      }
                      onDetailClose={() => setSelectedCourse(undefined)}
                    />
                  ))}
                  {!hasSummerQuarter ? <EmptySummerQuarter /> : null}
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
  const isSummerQuarter = quarter.startsWith("Summer");
  return (
    <section className={`${styles.quarter} ${isSummerQuarter ? styles.quarterSummer : ""}`} aria-label={quarter}>
      <header className={styles.quarterHeader}>
        <h2 className={styles.quarterTitle}>{quarter}</h2>
        <span className={styles.quarterMeta}>{formatGpa(courses)} GPA</span>
      </header>
      {courses.length ? (
        <div className={styles.courseList}>
          {courses.map((course) => {
            const grade = courseGradeLabel(course);
            const selected = selectedCourse?.id === course.id;
            const { code, title } = splitCourseName(course.name);
            const requirementSymbols = courseRequirementSymbols(course);
            return (
              <div className={styles.courseItem} key={course.id}>
                <button
                  className={styles.courseButton}
                  type="button"
                  data-selected={selected}
                  aria-expanded={selected}
                  onClick={() => onCourseSelect(course)}
                >
                  <span className={styles.courseIdentity} title={course.name}>
                    <span className={styles.courseCode}>{code}</span>
                    {title ? <span className={styles.courseTitle}>{title}</span> : null}
                  </span>
                  <span className={styles.requirementMarks} aria-label="Requirement coverage">
                    {requirementSymbols.map((symbol) => (
                      <span
                        className={`${styles.requirementMark} ${requirementVariantClasses[symbol.variant]}`}
                        title={symbol.tooltip}
                        key={symbol.family}
                      >
                        {symbol.label}
                      </span>
                    ))}
                  </span>
                  <span
                    className={styles.grade}
                    data-empty={grade === "—"}
                    data-progress={grade === "In progress"}
                  >
                    {grade === "—" ? "--" : grade}
                  </span>
                </button>
                {selected ? <CourseDetail course={course} onClose={onDetailClose} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyQuarter}>No courses recorded.</div>
      )}
    </section>
  );
}

function EmptySummerQuarter() {
  return (
    <section className={styles.emptySummerQuarter} aria-label="No summer session">
      <Sun size={30} strokeWidth={1.4} aria-hidden="true" />
      <p>No summer session</p>
    </section>
  );
}

function formatGpa(courses: readonly Course[]): string {
  return courseGpa(courses)?.toFixed(2) ?? "—";
}

function courseRequirementSymbols(course: Course): RequirementSymbol[] {
  const symbols: RequirementSymbol[] = [];
  const geCategories = course.geRequirementsUsed?.map((requirement) => requirement.category) ?? [];
  const breadthCategory = geCategories.find((category) => breadthRequirements.has(category));
  if (breadthCategory) {
    symbols.push({
      family: "breadth",
      label: breadthRequirements.get(breadthCategory) ?? "GE",
      tooltip: breadthCategory,
      variant: "breadth",
    });
  }

  const additionalCategories = geCategories.filter((category) => additionalRequirements.has(category));
  if (additionalCategories.length) {
    symbols.push({
      family: "additional",
      label: additionalCategories.map((category) => additionalRequirements.get(category)).join("/"),
      tooltip: additionalCategories.join(", "),
      variant: "additional",
    });
  }

  const majorRequirements = new Set(course.majorRequirements ?? []);
  const isCognitiveScience = majorRequirements.has("Cognitive Science");
  const isComputerScience = majorRequirements.has("Computer Science");
  if (isCognitiveScience || isComputerScience) {
    symbols.push({
      family: "major",
      label: isCognitiveScience && isComputerScience ? "CS²" : "CS",
      tooltip:
        isCognitiveScience && isComputerScience
          ? "Cognitive Science and Computer Science"
          : isCognitiveScience
            ? "Cognitive Science"
            : "Computer Science",
      variant:
        isCognitiveScience && isComputerScience
          ? "dualMajor"
          : isCognitiveScience
            ? "cognitiveScience"
            : "computerScience",
    });
  }

  const cgsGroup = [...majorRequirements].find((requirement) => /^CGS Group [A-F]$/.test(requirement));
  const cgsGroupLabel = cgsGroup?.match(/([A-F])$/)?.[1];
  const isCsElective = majorRequirements.has("Computer Science Electives");
  const isGeneralScience = majorRequirements.has("General Science");
  if (cgsGroup && cgsGroupLabel && isCsElective) {
    symbols.push({
      family: "track",
      label: `${cgsGroupLabel}/EL`,
      tooltip: `${cgsGroup}, Computer Science Electives`,
      variant: "dualTrack",
    });
  } else if (cgsGroup && cgsGroupLabel) {
    symbols.push({
      family: "track",
      label: cgsGroupLabel,
      tooltip: cgsGroup,
      variant: "cgsGroup",
    });
  } else if (isCsElective) {
    symbols.push({
      family: "track",
      label: "EL",
      tooltip: "Computer Science Electives",
      variant: "csElective",
    });
  } else if (isGeneralScience) {
    symbols.push({
      family: "track",
      label: "GS",
      tooltip: "General Science",
      variant: "generalScience",
    });
  }

  return symbols;
}

function splitCourseName(name: string): { code: string; title?: string } {
  const match = name.match(/^([A-Za-z&]{2,8}\s*-?\s*\d+[A-Za-z]?)(?:\s*[:—-]\s*|\s+)(.+)$/);
  if (!match) return { code: name };
  const [, matchedCode = name, matchedTitle] = match;
  return {
    code: matchedCode.replace(/\s+/g, " ").trim(),
    ...(matchedTitle ? { title: matchedTitle.trim() } : {}),
  };
}

function formatAcademicYearRange(quarters: readonly string[]): string {
  const years = quarters
    .map((quarter) => quarter.match(/(\d{4})$/)?.[1])
    .filter((value): value is string => Boolean(value));
  const uniqueYears = Array.from(new Set(years));
  return uniqueYears.length >= 2 ? `${uniqueYears[0]} - ${uniqueYears[uniqueYears.length - 1]}` : uniqueYears[0] ?? "";
}

function CourseDetail({ course, onClose }: { course: Course; onClose: () => void }) {
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && detailRef.current && !detailRef.current.contains(event.target)) {
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
          <span className={styles.tag} key={requirement.id}>
            {requirement.category}
          </span>
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
