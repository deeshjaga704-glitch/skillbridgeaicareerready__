import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LearningTaskList } from "@/components/learning-task-list";
import type { AuthenticatedLearningTasks } from "@/lib/supabase/learning-tasks";

const activeTask = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Practice TypeScript",
  description: "Write a typed utility.",
  category: "technical",
  difficulty: "intermediate",
  estimatedMinutes: 30,
  dueDate: "2026-09-20",
  status: "pending",
  completedAt: null,
};

const completedTask = {
  ...activeTask,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Review React patterns",
  status: "completed",
  completedAt: "2026-09-16T12:00:00.000Z",
};

const tasks: AuthenticatedLearningTasks = {
  active: [activeTask],
  completed: [completedTask],
};

afterEach(() => cleanup());

function renderTasks(overrides: Partial<React.ComponentProps<typeof LearningTaskList>> = {}) {
  return render(
    <LearningTaskList
      tasks={tasks}
      loading={false}
      error={null}
      completingTaskId={null}
      onComplete={vi.fn()}
      {...overrides}
    />,
  );
}

describe("LearningTaskList", () => {
  it("renders active tasks with their details and completed tasks separately", () => {
    renderTasks();

    expect(screen.getByText("Practice TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Write a typed utility.")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("Review React patterns")).toBeInTheDocument();
    expect(screen.getAllByText("Completed")).toHaveLength(1);
  });

  it("renders an empty active-task state", () => {
    renderTasks({ tasks: { active: [], completed: [completedTask] } });
    expect(screen.getByText("No active learning tasks yet.")).toBeInTheDocument();
  });

  it("renders an empty completed-task state", () => {
    renderTasks({ tasks: { active: [activeTask], completed: [] } });
    expect(screen.getByText("No completed learning tasks yet.")).toBeInTheDocument();
  });

  it("renders loading and task-load error states", () => {
    const { rerender } = renderTasks({ loading: true });
    expect(screen.getByText("Loading your learning tasks...")).toBeInTheDocument();

    rerender(
      <LearningTaskList
        tasks={null}
        loading={false}
        error="Task service unavailable"
        completingTaskId={null}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getByText("Task service unavailable")).toBeInTheDocument();
  });

  it("disables completion buttons while a task is completing", () => {
    renderTasks({ completingTaskId: activeTask.id });
    expect(screen.getByRole("button", { name: "Completing" })).toBeDisabled();
  });

  it("emits only the task ID when completing a task", () => {
    const onComplete = vi.fn();
    renderTasks({ onComplete });
    fireEvent.click(screen.getAllByRole("button", { name: "Complete" })[0]!);
    expect(onComplete).toHaveBeenCalledWith(activeTask.id);
    expect(onComplete.mock.calls[0]).toHaveLength(1);
  });

  it("renders the active-to-completed result after a successful completion", () => {
    const { rerender } = renderTasks();
    rerender(
      <LearningTaskList
        tasks={{ active: [], completed: [{ ...activeTask, status: "completed", completedAt: "2026-09-17T12:00:00.000Z" }] }}
        loading={false}
        error={null}
        completingTaskId={null}
        onComplete={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Complete" })).not.toBeInTheDocument();
    expect(screen.getByText("Practice TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("allows the parent to restore the active task after a completion failure", () => {
    const { rerender } = renderTasks({ completingTaskId: activeTask.id });
    rerender(
      <LearningTaskList
        tasks={tasks}
        loading={false}
        error={null}
        completingTaskId={null}
        onComplete={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Complete" })[0]).toBeEnabled();
  });
});
