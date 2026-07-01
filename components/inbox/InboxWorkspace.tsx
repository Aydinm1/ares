"use client";

import { GraduationCap, Inbox, Layers3, ListTodo } from "lucide-react";
import { AssignmentShell } from "../assignment-ui";
import { CaptureComposer } from "./InboxCapture";
import styles from "./inbox.module.css";

const icons = {
  brand: <Layers3 size={22} strokeWidth={2.2} />,
  assignments: <ListTodo size={19} strokeWidth={2} />,
  courses: <GraduationCap size={19} strokeWidth={2} />,
  inbox: <Inbox size={19} strokeWidth={2} />,
};

export function InboxWorkspace() {
  return (
    <AssignmentShell activeNav="inbox" icons={icons}>
      <section className={styles.intakeCanvas} aria-labelledby="inbox-capture-title">
        <div className={styles.intakeContent}>
          <h1 id="inbox-capture-title">What&apos;s on your mind?</h1>
          <CaptureComposer
            autoFocus
            variant="intake"
            submitOnEnter
            onCaptured={() => undefined}
          />
        </div>
      </section>
    </AssignmentShell>
  );
}
