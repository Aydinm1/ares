"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, Inbox, Send, X } from "lucide-react";
import { createInboxItem } from "../../src/app/apiClient";
import type { InboxItem } from "../../src/domain";
import styles from "./inbox.module.css";

interface CaptureComposerProps {
  autoFocus?: boolean;
  initialText?: string;
  onTextChange?: (text: string) => void;
  onCaptured: (item: InboxItem) => void;
  onCancel?: () => void;
  submitLabel?: string;
}

export function CaptureComposer({
  autoFocus = false,
  initialText = "",
  onTextChange,
  onCaptured,
  onCancel,
  submitLabel = "Capture",
}: CaptureComposerProps) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [text]);

  const submit = async () => {
    const normalized = text.trim();
    if (!normalized || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const item = await createInboxItem(normalized);
      setText("");
      onTextChange?.("");
      onCaptured(item);
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Capture could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <label className={styles.composerField}>
        <span className={styles.visuallyHidden}>Capture text</span>
        <textarea
          ref={textareaRef}
          rows={2}
          maxLength={2000}
          value={text}
          placeholder="What is on your mind?"
          onChange={(event) => {
            const nextText = event.currentTarget.value;
            setText(nextText);
            onTextChange?.(nextText);
          }}
          onKeyDown={handleKeyDown}
          disabled={saving}
        />
      </label>
      {error ? <p className={styles.captureError} role="alert">{error}</p> : null}
      <div className={styles.composerFooter}>
        <span className={styles.composerHint}>Cmd/Ctrl + Enter</span>
        <div className={styles.composerActions}>
          {onCancel ? (
            <button className={styles.secondaryButton} type="button" onClick={onCancel} disabled={saving}>
              Cancel
            </button>
          ) : null}
          <button className={styles.captureButton} type="submit" disabled={!text.trim() || saving}>
            <Send size={15} aria-hidden="true" />
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

export function InboxQuickCapture() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
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
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      triggerRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!confirmed) return;
    const timeout = window.setTimeout(() => setConfirmed(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [confirmed]);

  return (
    <>
      <button
        ref={triggerRef}
        className={styles.quickCaptureButton}
        type="button"
        aria-label="Quick capture"
        title="Quick capture"
        onClick={() => setOpen(true)}
      >
        <Inbox size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {open ? (
        <div className={styles.modalBackdrop} role="presentation">
          <button
            className={styles.modalScrim}
            type="button"
            aria-label="Close quick capture"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            className={styles.captureDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-capture-title"
          >
            <header className={styles.captureDialogHeader}>
              <div>
                <p>Inbox</p>
                <h2 id="quick-capture-title">Quick capture</h2>
              </div>
              <button
                className={styles.iconButton}
                type="button"
                aria-label="Close quick capture"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </header>
            <CaptureComposer
              autoFocus
              initialText={draft}
              onTextChange={setDraft}
              onCancel={() => setOpen(false)}
              onCaptured={() => {
                setDraft("");
                setOpen(false);
                setConfirmed(true);
              }}
            />
          </section>
        </div>
      ) : null}
      {confirmed ? (
        <div className={styles.captureToast} role="status">
          <Check size={16} aria-hidden="true" />
          Captured
        </div>
      ) : null}
    </>
  );
}
