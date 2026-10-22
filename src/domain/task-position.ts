import type { Task, TaskStatus } from "@roadmapper/api-contract/models";

export const columnTasks = (tasks: Task[], status: TaskStatus) =>
  tasks
    .filter((t) => t.status === status)
    .sort((a, b) =>
      a.sortOrder < b.sortOrder ? -1 : a.sortOrder > b.sortOrder ? 1 : a.id.localeCompare(b.id),
    );

export const moveDestination = (
  tasks: Task[],
  taskId: string,
  status: TaskStatus,
  index: number,
) => {
  const siblings = columnTasks(tasks, status).filter((t) => t.id !== taskId);
  const at = Math.max(0, Math.min(index, siblings.length));
  return {
    status,
    beforeTaskId: siblings[at - 1]?.id ?? null,
    afterTaskId: siblings[at]?.id ?? null,
  };
};
