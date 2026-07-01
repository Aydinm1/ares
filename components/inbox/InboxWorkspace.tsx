"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarDays,
  CircleAlert,
  GraduationCap,
  Inbox,
  Layers3,
  ListTodo,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  AssignmentShell,
  WorkspaceHeader,
  WorkspaceNotice,
  type AssignmentSyncState,
} from "../assignment-ui";
import { deleteInboxItem, loadInboxItems } from "../../src/app/apiClient";
import type { InboxItem } from "../../src/domain";
import { formatLastSyncedLabel } from "../../src/assignments";
import { CaptureComposer } from "./InboxCapture";
import styles from "./inbox.module.css";

const icons = {
  brand: <Layers3 size={22} strokeWidth={2.2} />,
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  inbox: <Inbox size={19} strokeWidth={2} />,
  calendar: <CalendarDays size={17} strokeWidth={2} />,
  sync: <RefreshCw size={16} strokeWidth={2} />,
};

export function InboxWorkspace() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [mutationError, setMutationError] = useState<string>();
  const [syncState, setSyncState] = useState<AssignmentSyncState>("syncing");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>();
  const [clock, setClock] = useState(() => new Date());
  const [deleteTarget, setDeleteTarget] = useState<InboxItem>();
  const [deletingId, setDeletingId] = useState<string>();
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);

  const loadInbox = useCallback(async () => {
    setSyncState("syncing");
    try {
      setItems(await loadInboxItems());
      const syncedAt = new Date();
      setLastSyncedAt(syncedAt);
      setClock(syncedAt);
      setLoadError(undefined);
      setSyncState("synced");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Inbox is unavailable.");
      setSyncState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!deleteTarget) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelDeleteRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !deletingId) {
        event.preventDefault();
        setDeleteTarget(undefined);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [deleteTarget, deletingId]);

  const syncLabel =
    syncState === "syncing"
      ? "Syncing..."
      : syncState === "error"
        ? "Sync failed"
        : lastSyncedAt
          ? formatLastSyncedLabel(lastSyncedAt, clock)
          : "Not synced";

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt)),
    [items],
  );

  const confirmDelete = async () => {
    if (!deleteTarget || deletingId) return;
    setDeletingId(deleteTarget.id);
    setMutationError(undefined);
    try {
      await deleteInboxItem(deleteTarget.id);
      setItems((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(undefined);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Capture could not be deleted.");
    } finally {
      setDeletingId(undefined);
    }
  };

  return (
    <AssignmentShell activeNav="inbox" icons={icons}>
      <WorkspaceHeader
        dateLabel="Unprocessed captures"
        title="Inbox"
        summary={
          <>
            <strong>{items.length} open {items.length === 1 ? "loop" : "loops"}</strong>.
          </>
        }
        syncState={syncState}
        syncLabel={syncLabel}
        icons={{ calendar: icons.calendar, sync: icons.sync }}
        onSync={() => void loadInbox()}
      />

      {mutationError ? (
        <WorkspaceNotice dismissIcon={<X size={17} />} onDismiss={() => setMutationError(undefined)}>
          {mutationError}
        </WorkspaceNotice>
      ) : null}

      <section className={styles.capturePanel} aria-labelledby="inbox-capture-title">
        <div className={styles.capturePanelHeader}>
          <h2 id="inbox-capture-title">New capture</h2>
        </div>
        <CaptureComposer
          submitLabel="Add to Inbox"
          onCaptured={(item) => setItems((current) => [item, ...current])}
        />
      </section>

      <section className={styles.inboxPanel} aria-labelledby="inbox-items-title">
        <header className={styles.inboxPanelHeader}>
          <h2 id="inbox-items-title">Unprocessed</h2>
          <span>{items.length}</span>
        </header>
        {loading ? <InboxSkeleton /> : null}
        {!loading && loadError ? (
          <InboxState
            icon={<CircleAlert size={20} />}
            title="Inbox could not be loaded"
            copy={loadError}
            actionLabel="Try again"
            onAction={() => void loadInbox()}
          />
        ) : null}
        {!loading && !loadError && sortedItems.length === 0 ? (
          <InboxState
            icon={<Inbox size={20} />}
            title="Inbox is clear"
            copy="New captures will appear here."
          />
        ) : null}
        {!loading && !loadError && sortedItems.length > 0 ? (
          <div className={styles.inboxList}>
            {sortedItems.map((item) => (
              <article className={styles.inboxItem} key={item.id}>
                <div>
                  <p>{item.text}</p>
                  <time dateTime={item.createdAt}>
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </time>
                </div>
                <button
                  className={styles.deleteButton}
                  type="button"
                  aria-label={`Delete capture: ${item.text}`}
                  title="Delete capture"
                  onClick={() => setDeleteTarget(item)}
                >
                  <Trash2 size={16} />
                </button>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      {deleteTarget ? (
        <div className={styles.confirmBackdrop} role="presentation">
          <button
            className={styles.modalScrim}
            type="button"
            aria-label="Cancel deleting capture"
            onClick={() => setDeleteTarget(undefined)}
          />
          <section
            className={styles.confirmDialog}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-capture-title"
          >
            <h2 id="delete-capture-title">Delete this capture?</h2>
            <p>{deleteTarget.text}</p>
            <div>
              <button
                ref={cancelDeleteRef}
                className={styles.secondaryButton}
                type="button"
                onClick={() => setDeleteTarget(undefined)}
                disabled={Boolean(deletingId)}
              >
                Cancel
              </button>
              <button
                className={styles.dangerButton}
                type="button"
                onClick={() => void confirmDelete()}
                disabled={Boolean(deletingId)}
              >
                {deletingId ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </AssignmentShell>
  );
}

function InboxState({
  icon,
  title,
  copy,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.inboxState}>
      <span aria-hidden="true">{icon}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {actionLabel && onAction ? (
        <button className={styles.secondaryButton} type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="Loading Inbox" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => <div className={styles.skeletonRow} key={index} />)}
    </div>
  );
}
