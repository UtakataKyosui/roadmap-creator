import type { Task, TaskCreate, TaskStatus, TaskUpdate } from "@roadmapper/api-contract/models";
import { CreateTaskInput } from "./validation";

export const initialTaskInput = (status: TaskStatus = "todo"): TaskCreate => ({
  title: "",
  description: null,
  assigneeId: null,
  startDate: null,
  dueDate: null,
  status,
  priority: "medium",
  labelIds: [],
});

export const taskInput = (task: Task): TaskCreate => ({
  title: task.title,
  description: task.description,
  assigneeId: task.assigneeId,
  startDate: task.startDate,
  dueDate: task.dueDate,
  status: task.status,
  priority: task.priority,
  labelIds: [...task.labelIds],
});

// レスポンスから監査情報を送らず、変更された入力だけをPATCHする。
export const taskPatch = (current: Task, input: TaskCreate): TaskUpdate => {
  const original = taskInput(current);
  return {
    version: current.version,
    ...Object.fromEntries(
      Object.entries(input).filter(
        ([key, value]) =>
          JSON.stringify(value) !== JSON.stringify(original[key as keyof TaskCreate]),
      ),
    ),
  };
};

export const validateTaskInput = (input: TaskCreate) => CreateTaskInput.safeParse(input);
