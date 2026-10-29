"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { clockLabel, formatDate, minutesOf } from "@/components/ui/date-math";
import { EmptyState } from "@/components/ui/empty-state";
import { FileField } from "@/components/ui/file-field";
import { FilterMenu } from "@/components/ui/filter-menu";
import { Form } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { clientTaskHref } from "@/content/routes";
import { CLIENT_ATTACHMENT_ACCEPT } from "@/features/clients/attachment";
import { createTask } from "../actions";
import { TASK_LIMITS, TASK_SEVERITIES, TASK_SEVERITY_LABELS, TASK_STATUS_LABELS, TASK_STATUS_TONES, type TaskField, type TaskStatus } from "../contract";
import { DeadlineFields } from "./deadline-fields";
import { VaAssignField } from "./va-assign-field";
import { TASK_GROUPS, TASK_GROUP_LABELS, tasksInGroup, type TaskGroup } from "../task-groups";

export type BoardTask = {
  id: string;
  title: string;
  status: TaskStatus;
  vaFirstName: string;
  deadline: string;
  deadlineTime: string | null;
};

const EMPTY: Record<(typeof TASK_GROUPS)[number], { title: string; description: string }> = {
  all: { title: "No tasks yet", description: "Add a task with a deadline for your assistant." },
  pending: { title: "No pending tasks", description: "Open tasks show here." },
  unassigned: { title: "No unassigned tasks", description: "Every task is with an assistant." },
  completed: { title: "No completed tasks", description: "Finished tasks show here." },
};

/** The dashboard task list, with Add task opening the form in a modal. */
export function ClientTaskBoard({
  tasks,
  today,
  last,
  timeZone,
  vas,
}: {
  tasks: readonly BoardTask[];
  today: string;
  last: string;
  timeZone: string;
  vas: readonly { id: string; firstName: string }[];
}) {
  const [adding, setAdding] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [group, setGroup] = useState<Exclude<TaskGroup, "all"> | undefined>();
  const shown = tasksInGroup(tasks, group ?? "all");
  const empty = EMPTY[group ?? "all"];

  return (
    <Card as="section" aria-label="Tasks" className="grid content-start gap-4 overflow-hidden">
      <div className="flex items-center gap-3">
        <h2 className="m-0 flex-1 type-h3">Tasks</h2>
        <FilterMenu
          options={[
            { value: "pending", label: TASK_GROUP_LABELS.pending },
            { value: "unassigned", label: TASK_GROUP_LABELS.unassigned },
            { value: "completed", label: TASK_GROUP_LABELS.completed },
          ]}
          value={group}
          onChange={setGroup}
          allLabel={TASK_GROUP_LABELS.all}
        />
        <Button
          type="button"
          iconLeft="plus"
          onClick={() => {
            setFormKey((key) => key + 1);
            setAdding(true);
          }}
        >
          Add task
        </Button>
      </div>
      <Modal open={adding} onClose={() => setAdding(false)} title="Add a task" size="wide">
        <Form<TaskField>
          aria-label="Add a task"
          onSubmit={async (formData) => {
            const result = await createTask(formData);
            if (result.ok) setAdding(false);
            return result;
          }}
          className="gap-4"
        >
          {({ pending, fieldErrors }) => (
            <>
              <input type="hidden" name="stay" value="1" />
              <TextField label="Task title" name="title" required maxLength={TASK_LIMITS.title} autoFocus error={fieldErrors.title} />
              <TextField label="Task description" name="description" multiline optional maxLength={TASK_LIMITS.description} error={fieldErrors.description} />
              <Select
                label="Task severity"
                name="severity"
                required
                placeholder="Choose a severity"
                options={TASK_SEVERITIES.map((severity) => ({ value: severity, label: TASK_SEVERITY_LABELS[severity] }))}
                error={fieldErrors.severity}
              />
              <DeadlineFields today={today} last={last} timeZone={timeZone} dateError={fieldErrors.deadline} timeError={fieldErrors.deadlineTime} />
              <VaAssignField key={formKey} vas={vas} error={fieldErrors.vaId} />
              <FileField label="Attachments" name="attachment" multiple optional accept={CLIENT_ATTACHMENT_ACCEPT} hint="Up to 3 files. PDF, image or audio, 2 MB in total." />
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending}>
                  {pending ? "Saving" : "Add task"}
                </Button>
              </div>
            </>
          )}
        </Form>
      </Modal>
      <div className="task-board -mx-6 -mb-6">
        <TaskRows tasks={shown} empty={empty} />
      </div>
    </Card>
  );
}

const columns: Column<BoardTask>[] = [
  {
    key: "title",
    label: "Title",
    render: (task) => (
      <Link href={clientTaskHref(task.id)} className="row-link" title={task.title}>
        {task.title}
      </Link>
    ),
  },
  {
    key: "deadline",
    label: "Deadline",
    width: "15rem",
    render: (task) => {
      const day = formatDate(task.deadline, { dateStyle: "medium" });
      const label = task.deadlineTime ? `${day}, ${clockLabel(minutesOf(task.deadlineTime))}` : day;
      return <span title={label}>{label}</span>;
    },
  },
  { key: "va", label: "Assigned VA", width: "10rem", render: (task) => task.vaFirstName },
  {
    key: "status",
    label: "Status",
    width: "9rem",
    render: (task) => (
      <Badge tone={TASK_STATUS_TONES[task.status]} size="sm">
        {TASK_STATUS_LABELS[task.status]}
      </Badge>
    ),
  },
];

function TaskRows({ tasks, empty }: { tasks: readonly BoardTask[]; empty: { title: string; description: string } }) {
  return (
    <DataTable
      caption="Tasks"
      columns={columns}
      rows={tasks}
      rowKey={(task) => task.id}
      rowLabel={(task) => task.title}
      selectable={false}
      attached
      keepHeader
      empty={<EmptyState compact headingLevel={3} title={empty.title} description={empty.description} />}
    />
  );
}
