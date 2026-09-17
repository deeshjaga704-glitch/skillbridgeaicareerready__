import { CheckCircle2, Circle, Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AuthenticatedLearningTasks, LearningTask } from "@/lib/supabase/learning-tasks";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function TaskMeta({ task }: { task: LearningTask }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {task.category && <Badge variant="outline" className="rounded-full">{task.category}</Badge>}
      {task.difficulty && <span>{task.difficulty}</span>}
      {task.estimatedMinutes !== null && <span>{task.estimatedMinutes} min</span>}
      {task.dueDate && <span>Due {formatDate(task.dueDate)}</span>}
    </div>
  );
}

function ActiveTask({ task, completingTaskId, onComplete }: {
  task: LearningTask;
  completingTaskId: string | null;
  onComplete: (taskId: string) => void;
}) {
  const isCompleting = completingTaskId === task.id;
  return (
    <li className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Circle className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="font-semibold">{task.title}</h3>
            <Badge className="rounded-full">Active</Badge>
          </div>
          {task.description && <p className="text-sm leading-6 text-muted-foreground">{task.description}</p>}
          <TaskMeta task={task} />
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 rounded-full"
          disabled={completingTaskId !== null}
          onClick={() => onComplete(task.id)}
        >
          {isCompleting && <Loader2 className="h-4 w-4 animate-spin" />}
          {isCompleting ? "Completing" : "Complete"}
        </Button>
      </div>
    </li>
  );
}

function CompletedTask({ task }: { task: LearningTask }) {
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
      <span className="font-medium">{task.title}</span>
      <Badge variant="secondary" className="rounded-full text-success">Completed</Badge>
      {task.completedAt && (
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" /> {formatDate(task.completedAt)}
        </span>
      )}
    </li>
  );
}

export function LearningTaskList({
  tasks,
  loading,
  error,
  completingTaskId,
  onComplete,
}: {
  tasks: AuthenticatedLearningTasks | null;
  loading: boolean;
  error: string | null;
  completingTaskId: string | null;
  onComplete: (taskId: string) => void;
}) {
  if (loading) {
    return (
      <section aria-labelledby="learning-tasks-heading" className="rounded-3xl border border-border/60 bg-card p-6">
        <h2 id="learning-tasks-heading" className="font-display text-lg font-bold">Learning tasks</h2>
        <p className="mt-4 text-sm text-muted-foreground">Loading your learning tasks...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section aria-labelledby="learning-tasks-heading" className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 id="learning-tasks-heading" className="font-display text-lg font-bold">Learning tasks</h2>
        <p className="mt-2 text-sm text-destructive">{error}</p>
      </section>
    );
  }

  const active = tasks?.active ?? [];
  const completed = tasks?.completed ?? [];
  return (
    <section aria-labelledby="learning-tasks-heading" className="rounded-3xl border border-border/60 bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="learning-tasks-heading" className="font-display text-lg font-bold">Learning tasks</h2>
          <p className="mt-1 text-sm text-muted-foreground">Small actions that turn skill gaps into verified progress.</p>
        </div>
        <span className="text-xs text-muted-foreground">{active.length} active</span>
      </div>

      <div className="mt-5 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active tasks</h3>
        {active.length > 0 ? (
          <ul className="space-y-2">
            {active.map((task) => <ActiveTask key={task.id} task={task} completingTaskId={completingTaskId} onComplete={onComplete} />)}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No active learning tasks yet.</p>
        )}
      </div>

      <div className="mt-6 space-y-3 border-t border-border/60 pt-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Completed tasks</h3>
        {completed.length > 0 ? (
          <ul className="space-y-2">
            {completed.map((task) => <CompletedTask key={task.id} task={task} />)}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">No completed learning tasks yet.</p>
        )}
      </div>
    </section>
  );
}
