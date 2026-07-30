"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calculator,
  CalendarDays,
  CircleAlert,
  CircleCheckBig,
  Compass,
  GraduationCap,
  Inbox,
  ListTodo,
  RefreshCw,
  Save,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  AssignmentShell,
  WorkspaceHeader,
  type AssignmentSyncState,
} from "../assignment-ui";
import {
  createAssignment,
  createGradeCategory,
  deleteGradeCategory,
  loadAssignments,
  loadCourses,
  loadGradeCategories,
  updateAssignmentDetails,
  updateGradeCategory,
} from "../../src/app/apiClient";
import { formatLastSyncedLabel } from "../../src/assignments";
import { calculateCourseGrade } from "../../src/grades/calculator";
import type { Assignment, Course, GradeCategory, GradeCategoryUpdate } from "../../src/domain";
import styles from "./grades.module.css";

const icons = {
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  intake: <Inbox size={19} strokeWidth={2} />,
  habits: <CircleCheckBig size={19} strokeWidth={2} />,
  competencies: <Compass size={19} strokeWidth={2} />,
  contacts: <UsersRound size={19} strokeWidth={2} />,
  grades: <Calculator size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
};

const PSC_141_POLICY = [
  { name: "Exam 1", weightPercent: 25, match: /exam 1/i, pointsPossible: 25 },
  { name: "Exam 2", weightPercent: 25, match: /exam 2/i, pointsPossible: 25 },
  { name: "Selection and Summary Assignment", weightPercent: 10, match: /selection and summary/i, pointsPossible: 10 },
  { name: "Background Paper", weightPercent: 20, match: /background paper/i, pointsPossible: 20 },
  { name: "Advice Column", weightPercent: 16, match: /advice column/i, pointsPossible: 16 },
  { name: "Workshops", weightPercent: 4, match: /^workshop:/i, pointsPossible: undefined },
] as const;

interface AssignmentDraft {
  pointsEarned: string;
  pointsPossible: string;
  categoryId: string;
}

interface CategoryDraft {
  name: string;
  weightPercent: string;
  calculationType: GradeCategory["calculationType"];
  maxExtraCreditPercent: string;
}

export function GradesWorkspace() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [gradeCategories, setGradeCategories] = useState<GradeCategory[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>();
  const [syncState, setSyncState] = useState<AssignmentSyncState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [loadError, setLoadError] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, AssignmentDraft>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [newCategory, setNewCategory] = useState<CategoryDraft>({
    name: "",
    weightPercent: "",
    calculationType: "required",
    maxExtraCreditPercent: ""
  });
  const [extraCreditDrafts, setExtraCreditDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string>();

  const activeCourses = useMemo(
    () => courses.filter((course) => course.status === "in_progress"),
    [courses]
  );
  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? activeCourses[0],
    [activeCourses, courses, selectedCourseId]
  );
  const selectedCourseAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.courseId === selectedCourse?.id),
    [assignments, selectedCourse?.id]
  );
  const selectedCourseCategories = useMemo(
    () => gradeCategories.filter((category) => category.courseId === selectedCourse?.id),
    [gradeCategories, selectedCourse?.id]
  );
  const extraCreditCategory = useMemo(
    () => selectedCourseCategories.find((category) => category.calculationType === "extra_credit"),
    [selectedCourseCategories]
  );
  const extraCreditAssignment = useMemo(
    () =>
      extraCreditCategory
        ? selectedCourseAssignments.find((assignment) => assignment.categoryId === extraCreditCategory.id)
        : undefined,
    [extraCreditCategory, selectedCourseAssignments]
  );
  const extraCreditDraft = selectedCourse
    ? extraCreditDrafts[selectedCourse.id] ?? extraCreditAssignment?.pointsEarned?.toString() ?? ""
    : "";
  const draftExtraCreditPercent = useMemo(
    () => clampExtraCredit(numberOrNull(extraCreditDraft) ?? 0, extraCreditCategory),
    [extraCreditCategory, extraCreditDraft]
  );
  const gradeSummary = useMemo(
    () =>
      selectedCourse
        ? calculateCourseGrade(selectedCourse, assignments, gradeCategories)
        : undefined,
    [assignments, gradeCategories, selectedCourse]
  );
  const currentWithExtraCredit = useMemo(
    () =>
      gradeSummary?.currentPercent === undefined
        ? undefined
        : roundOne(gradeSummary.currentPercent + draftExtraCreditPercent),
    [draftExtraCreditPercent, gradeSummary?.currentPercent]
  );
  const finalPointsSecured = useMemo(
    () =>
      gradeSummary
        ? roundOne(gradeSummary.earnedFinalPercent - gradeSummary.extraCreditEarnedPercent + draftExtraCreditPercent)
        : undefined,
    [draftExtraCreditPercent, gradeSummary]
  );
  const projectedFinal = useMemo(
    () =>
      gradeSummary
        ? roundOne(gradeSummary.projectedFinalPercent - gradeSummary.extraCreditEarnedPercent + draftExtraCreditPercent)
        : undefined,
    [draftExtraCreditPercent, gradeSummary]
  );

  const loadData = useCallback(async (refresh = false) => {
    setSyncState("syncing");
    setLoadError(undefined);
    try {
      const [nextCourses, nextAssignments, nextGradeCategories] = await Promise.all([
        loadCourses({ refresh }),
        loadAssignments({ refresh }),
        loadGradeCategories({ refresh })
      ]);
      setCourses(nextCourses);
      setAssignments(nextAssignments);
      setGradeCategories(nextGradeCategories);
      setLastSyncedAt(new Date());
      setSyncState("synced");
      setSelectedCourseId((current) =>
        current && nextCourses.some((course) => course.id === current && course.status === "in_progress")
          ? current
          : nextCourses.find((course) => course.status === "in_progress")?.id
      );
      setAssignmentDrafts(Object.fromEntries(nextAssignments.map((assignment) => [
        assignment.id,
        {
          pointsEarned: assignment.pointsEarned?.toString() ?? "",
          pointsPossible: assignment.pointsPossible?.toString() ?? "",
          categoryId: assignment.categoryId ?? ""
        }
      ])));
      setCategoryDrafts(Object.fromEntries(nextGradeCategories.map((category) => [
        category.id,
        categoryDraftFromCategory(category)
      ])));
      const extraCategoryIds = new Set(
        nextGradeCategories
          .filter((category) => category.calculationType === "extra_credit")
          .map((category) => category.id)
      );
      setExtraCreditDrafts(Object.fromEntries(
        nextAssignments
          .filter((assignment) => assignment.courseId && assignment.categoryId && extraCategoryIds.has(assignment.categoryId))
          .map((assignment) => [assignment.courseId!, assignment.pointsEarned?.toString() ?? ""])
      ));
    } catch (error) {
      setSyncState("error");
      setLoadError(error instanceof Error ? error.message : "Could not load grades.");
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveAllChanges = useCallback(async () => {
    if (!selectedCourse) return;
    setSavingId("save-all");
    setMutationError(undefined);
    try {
      for (const category of selectedCourseCategories) {
        const draft = categoryDrafts[category.id];
        if (!draft) continue;
        await updateGradeCategory(category.id, categoryUpdateFromDraft(draft));
      }
      if (newCategory.name.trim()) {
        await createGradeCategory({
          ...categoryUpdateFromDraft(newCategory),
          courseId: selectedCourse.id
        });
        setNewCategory({
          name: "",
          weightPercent: "",
          calculationType: "required",
          maxExtraCreditPercent: ""
        });
      }
      for (const assignment of selectedCourseAssignments) {
        const draft = assignmentDrafts[assignment.id];
        if (!draft) continue;
        await updateAssignmentDetails(assignment.id, {
          pointsEarned: numberOrNull(draft.pointsEarned),
          pointsPossible: numberOrNull(draft.pointsPossible),
          categoryId: draft.categoryId || null
        });
      }
      if (extraCreditCategory) {
        const pointsEarned = numberOrNull(extraCreditDraft);
        const pointsPossible = extraCreditCategory.maxExtraCreditPercent ?? 3;
        if (extraCreditAssignment) {
          await updateAssignmentDetails(extraCreditAssignment.id, {
            pointsEarned,
            pointsPossible,
            categoryId: extraCreditCategory.id
          });
        } else if (pointsEarned !== null) {
          await createAssignment({
            title: "Extra Credit",
            courseId: selectedCourse.id,
            categoryId: extraCreditCategory.id,
            pointsEarned,
            pointsPossible,
            status: "submitted"
          });
        }
      }
      await loadData(true);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not save grade changes.");
    } finally {
      setSavingId(undefined);
    }
  }, [
    assignmentDrafts,
    categoryDrafts,
    extraCreditAssignment,
    extraCreditCategory,
    extraCreditDraft,
    loadData,
    newCategory,
    selectedCourse,
    selectedCourseAssignments,
    selectedCourseCategories
  ]);

  const deleteCategory = useCallback(async (category: GradeCategory) => {
    setSavingId(category.id);
    setMutationError(undefined);
    try {
      await deleteGradeCategory(category.id);
      setCategoryDrafts((current) => {
        const next = { ...current };
        delete next[category.id];
        return next;
      });
      setAssignmentDrafts((current) =>
        Object.fromEntries(
          Object.entries(current).map(([assignmentId, draft]) => [
            assignmentId,
            draft.categoryId === category.id ? { ...draft, categoryId: "" } : draft
          ])
        )
      );
      await loadData(true);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not delete weight row.");
    } finally {
      setSavingId(undefined);
    }
  }, [loadData]);

  const applyPsc141Policy = useCallback(async () => {
    if (!selectedCourse) return;
    setSavingId("psc141");
    setMutationError(undefined);
    try {
      let nextCategories = selectedCourseCategories;
      const categoriesByName = new Map(nextCategories.map((category) => [category.name, category]));
      const desiredCategories: GradeCategory[] = [];

      for (const desired of PSC_141_POLICY) {
        const existing = categoriesByName.get(desired.name);
        const update: GradeCategoryUpdate = {
          courseId: selectedCourse.id,
          name: desired.name,
          weightPercent: desired.weightPercent,
          calculationType: "required",
          maxExtraCreditPercent: null
        };
        const saved = existing
          ? await updateGradeCategory(existing.id, update)
          : await createGradeCategory(update);
        desiredCategories.push(saved);
      }

      const extraCredit = categoriesByName.get("Extra Credit");
      if (extraCredit) {
        await updateGradeCategory(extraCredit.id, {
          courseId: selectedCourse.id,
          name: "Extra Credit",
          weightPercent: 0,
          calculationType: "extra_credit",
          maxExtraCreditPercent: 3
        });
      } else {
        await createGradeCategory({
          courseId: selectedCourse.id,
          name: "Extra Credit",
          weightPercent: 0,
          calculationType: "extra_credit",
          maxExtraCreditPercent: 3
        });
      }

      nextCategories = [...nextCategories, ...desiredCategories];
      const desiredByName = new Map(desiredCategories.map((category) => [category.name, category]));
      for (const category of selectedCourseCategories) {
        if ((category.name === "Exams" || category.name === "Term Project") && category.weightPercent !== 0) {
          await updateGradeCategory(category.id, { weightPercent: 0, calculationType: "required" });
        }
      }
      for (const assignment of selectedCourseAssignments) {
        const desired = PSC_141_POLICY.find((policy) => policy.match.test(assignment.title));
        if (!desired) continue;
        const category = desiredByName.get(desired.name);
        if (!category) continue;
        await updateAssignmentDetails(assignment.id, {
          categoryId: category.id,
          pointsPossible: desired.pointsPossible ?? assignment.pointsPossible ?? null
        });
      }
      await loadData(true);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not apply PSC 141 policy.");
    } finally {
      setSavingId(undefined);
    }
  }, [loadData, selectedCourse, selectedCourseAssignments, selectedCourseCategories]);

  return (
    <AssignmentShell activeNav="grades" icons={icons}>
      <WorkspaceHeader
        dateLabel="Gradebook"
        title="Grade calculator"
        summary={
          <>
            Track <strong>{activeCourses.length}</strong> active course{activeCourses.length === 1 ? "" : "s"} with weighted grades and extra credit.
          </>
        }
        syncState={syncState}
        syncLabel={lastSyncedAt ? formatLastSyncedLabel(lastSyncedAt) : "Not synced"}
        icons={icons}
        onSync={() => void loadData(true)}
      />

      {loadError ? <p className={styles.error}>{loadError}</p> : null}
      {mutationError ? <p className={styles.error}>{mutationError}</p> : null}

      <div className={styles.layout}>
        <aside className={styles.courseList} aria-label="Courses">
          <p className={styles.panelLabel}>Active</p>
          <div className={styles.activeCourseStack}>
            {activeCourses.map((course) => (
              <button
                key={course.id}
                className={styles.courseButton}
                data-active={course.id === selectedCourse?.id}
                type="button"
                onClick={() => setSelectedCourseId(course.id)}
              >
                <span className={styles.courseIdentity} title={course.name}>
                  <span className={styles.courseCode}>{course.name}</span>
                  <span className={styles.courseTitle}>{course.quarterTaken ?? "Current"}</span>
                </span>
              </button>
            ))}
          </div>
          <p className={styles.panelLabel}>History</p>
          <div className={styles.historyList} aria-label="Completed course grades" />
        </aside>

        <section className={styles.gradePanel} aria-labelledby="grade-course-title">
          {selectedCourse && gradeSummary ? (
            <>
              <div className={styles.courseHeader}>
                <div>
                  <p className={styles.panelLabel}>{selectedCourse.quarterTaken ?? "Course"}</p>
                  <h2 id="grade-course-title">{selectedCourse.name}</h2>
                </div>
                <div className={styles.courseActions}>
                  {/psc\s*141/i.test(selectedCourse.name) ? (
                    <button
                      className={styles.primaryButton}
                      type="button"
                      onClick={applyPsc141Policy}
                      disabled={savingId === "psc141" || savingId === "save-all"}
                    >
                      <RefreshCw size={15} aria-hidden="true" />
                      PSC 141 setup
                    </button>
                  ) : null}
                  <button
                    className={styles.saveButton}
                    type="button"
                    onClick={() => void saveAllChanges()}
                    disabled={savingId === "save-all" || savingId === "psc141"}
                  >
                    <Save size={15} aria-hidden="true" />
                    {savingId === "save-all" ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>

              <div className={styles.metricsGrid}>
                <Metric label="Grade so far" value={formatPercent(gradeSummary.currentPercent)} />
                <Metric label="Current + EC" value={formatPercent(currentWithExtraCredit)} />
                <Metric label="Final points secured" value={`${formatPercent(finalPointsSecured)} / 100`} />
                <Metric label="Projected final" value={formatPercent(projectedFinal)} />
              </div>

              {gradeSummary.warnings.length ? (
                <div className={styles.warningBox}>
                  <CircleAlert size={17} aria-hidden="true" />
                  <div>
                    {gradeSummary.warnings.map((warning) => (
                      <p key={warning}>{warning}</p>
                    ))}
                  </div>
                </div>
              ) : null}

              {extraCreditCategory ? (
                <div className={styles.extraCreditPanel}>
                  <div>
                    <p className={styles.panelLabel}>Extra Credit</p>
                    <h3>Bonus points collected</h3>
                    <p>
                      Enter final-grade percentage points earned. This course caps extra credit at{" "}
                      {formatPercent(extraCreditCategory.maxExtraCreditPercent ?? 3)}.
                    </p>
                  </div>
                  <input
                    aria-label="Extra credit points earned"
                    inputMode="decimal"
                    placeholder="0"
                    value={extraCreditDraft}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      if (!selectedCourse) return;
                      setExtraCreditDrafts((current) => ({
                        ...current,
                        [selectedCourse.id]: value
                      }));
                    }}
                  />
                </div>
              ) : null}

              <div className={styles.sectionHeader}>
                <h3>Weights</h3>
                <span>{formatPercent(gradeSummary.requiredWeightPercent)} required</span>
              </div>
              <div className={styles.categoryTable}>
                {selectedCourseCategories.map((category) => {
                  const draft = categoryDrafts[category.id] ?? categoryDraftFromCategory(category);
                  return (
                    <div className={styles.categoryRow} key={category.id}>
                      <input
                        aria-label={`${category.name} name`}
                        value={draft.name}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: { ...draft, name: value }
                          }));
                        }}
                      />
                      <input
                        aria-label={`${category.name} weight`}
                        inputMode="decimal"
                        value={draft.weightPercent}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: { ...draft, weightPercent: value }
                          }));
                        }}
                      />
                      <select
                        aria-label={`${category.name} calculation type`}
                        value={draft.calculationType ?? "required"}
                        onChange={(event) => {
                          const value = event.currentTarget.value as GradeCategory["calculationType"];
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: {
                              ...draft,
                              calculationType: value
                            }
                          }));
                        }}
                      >
                        <option value="required">Required</option>
                        <option value="extra_credit">Extra Credit</option>
                      </select>
                      <input
                        aria-label={`${category.name} extra credit cap`}
                        inputMode="decimal"
                        placeholder="Cap"
                        value={draft.maxExtraCreditPercent}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setCategoryDrafts((current) => ({
                            ...current,
                            [category.id]: { ...draft, maxExtraCreditPercent: value }
                          }));
                        }}
                      />
                      <button
                        aria-label={`Delete ${category.name} weight row`}
                        className={styles.rowIconButton}
                        type="button"
                        onClick={() => void deleteCategory(category)}
                        disabled={savingId === category.id || savingId === "save-all" || savingId === "psc141"}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
                <div className={styles.categoryRow}>
                  <input
                    aria-label="New category name"
                    placeholder="New category"
                    value={newCategory.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setNewCategory((current) => ({
                        ...current,
                        name: value
                      }));
                    }}
                  />
                  <input
                    aria-label="New category weight"
                    inputMode="decimal"
                    placeholder="Weight"
                    value={newCategory.weightPercent}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setNewCategory((current) => ({
                        ...current,
                        weightPercent: value
                      }));
                    }}
                  />
                  <select
                    aria-label="New category calculation type"
                    value={newCategory.calculationType ?? "required"}
                    onChange={(event) => {
                      const value = event.currentTarget.value as GradeCategory["calculationType"];
                      setNewCategory((current) => ({
                        ...current,
                        calculationType: value
                      }));
                    }}
                  >
                    <option value="required">Required</option>
                    <option value="extra_credit">Extra Credit</option>
                  </select>
                  <input
                    aria-label="New category extra credit cap"
                    inputMode="decimal"
                    placeholder="Cap"
                    value={newCategory.maxExtraCreditPercent}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setNewCategory((current) => ({
                        ...current,
                        maxExtraCreditPercent: value
                      }));
                    }}
                  />
                  <span className={styles.pendingAdd}>Saved with changes</span>
                </div>
              </div>

              <div className={styles.sectionHeader}>
                <h3>Scores</h3>
                <span>{selectedCourseAssignments.length} assignments</span>
              </div>
              <div className={styles.assignmentTable}>
                {selectedCourseAssignments
                  .filter((assignment) => (assignment.pointsPossible ?? 0) > 0 || assignment.categoryId)
                  .map((assignment) => {
                    const draft = assignmentDrafts[assignment.id] ?? {
                      pointsEarned: assignment.pointsEarned?.toString() ?? "",
                      pointsPossible: assignment.pointsPossible?.toString() ?? "",
                      categoryId: assignment.categoryId ?? ""
                    };
                    return (
                      <div className={styles.assignmentRow} key={assignment.id}>
                        <div className={styles.assignmentTitle}>
                          <strong>{assignment.title}</strong>
                          <span>{assignment.status.replaceAll("_", " ")}</span>
                        </div>
                        <select
                          aria-label={`${assignment.title} category`}
                          value={draft.categoryId}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [assignment.id]: { ...draft, categoryId: value }
                            }));
                          }}
                        >
                          <option value="">No category</option>
                          {selectedCourseCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                        <input
                          aria-label={`${assignment.title} points earned`}
                          inputMode="decimal"
                          placeholder="Earned"
                          value={draft.pointsEarned}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [assignment.id]: { ...draft, pointsEarned: value }
                            }));
                          }}
                        />
                        <input
                          aria-label={`${assignment.title} points possible`}
                          inputMode="decimal"
                          placeholder="Possible"
                          value={draft.pointsPossible}
                          onChange={(event) => {
                            const value = event.currentTarget.value;
                            setAssignmentDrafts((current) => ({
                              ...current,
                              [assignment.id]: { ...draft, pointsPossible: value }
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
              </div>
            </>
          ) : (
            <p className={styles.empty}>No active courses found.</p>
          )}
        </section>
      </div>
    </AssignmentShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function categoryDraftFromCategory(category: GradeCategory): CategoryDraft {
  return {
    name: category.name,
    weightPercent: category.weightPercent.toString(),
    calculationType: category.calculationType ?? "required",
    maxExtraCreditPercent: category.maxExtraCreditPercent?.toString() ?? ""
  };
}

function categoryUpdateFromDraft(draft: CategoryDraft): GradeCategoryUpdate {
  return {
    name: draft.name,
    weightPercent: numberOrZero(draft.weightPercent),
    calculationType: draft.calculationType ?? "required",
    maxExtraCreditPercent:
      draft.calculationType === "extra_credit" ? numberOrNull(draft.maxExtraCreditPercent) : null
  };
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value: string): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatPercent(value: number | undefined): string {
  return value === undefined ? "--" : `${value.toFixed(1)}%`;
}

function clampExtraCredit(
  value: number,
  extraCreditCategory: GradeCategory | undefined
): number {
  const cap = extraCreditCategory?.maxExtraCreditPercent ?? 0;
  return roundOne(Math.min(cap, Math.max(0, value)));
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
