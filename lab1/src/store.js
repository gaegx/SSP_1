const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const STATUSES = ["open", "in_progress", "done"];

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
  }
}

class TaskStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.tasks = [];
    this.#load();
  }

  list(status) {
    if (!status || status === "all") {
      return [...this.tasks];
    }
    this.#assertStatus(status);
    return this.tasks.filter((task) => task.status === status);
  }

  get(id) {
    const task = this.tasks.find((item) => item.id === id);
    if (!task) {
      throw new NotFoundError("Задача не найдена");
    }
    return task;
  }

  create(input) {
    const task = {
      id: randomUUID(),
      ...this.#normalize(input),
      files: [],
    };
    this.tasks.push(task);
    this.#save();
    return task;
  }

  update(id, input) {
    const task = this.get(id);
    const next = this.#normalize(input);
    task.title = next.title;
    task.status = next.status;
    task.dueDate = next.dueDate;
    this.#save();
    return task;
  }

  delete(id) {
    const task = this.get(id);
    this.tasks = this.tasks.filter((item) => item.id !== task.id);
    this.#save();
    return task;
  }

  attachFile(id, fileInput) {
    const task = this.get(id);
    if (!fileInput || !fileInput.originalName || !fileInput.storedName) {
      throw new ValidationError("Файл не передан");
    }

    const file = {
      id: randomUUID(),
      originalName: fileInput.originalName,
      storedName: fileInput.storedName,
      mimeType: fileInput.mimeType,
      size: fileInput.size,
    };
    task.files.push(file);
    this.#save();
    return file;
  }

  removeFile(taskId, fileId) {
    const task = this.get(taskId);
    const file = task.files.find((item) => item.id === fileId);
    if (!file) {
      throw new NotFoundError("Файл не найден");
    }
    task.files = task.files.filter((item) => item.id !== fileId);
    this.#save();
    return file;
  }

  #normalize(input) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) {
      throw new ValidationError("Название задачи обязательно");
    }

    const status = input.status;
    this.#assertStatus(status);

    const dueDate = typeof input.dueDate === "string" ? input.dueDate.trim() : "";
    if (!dueDate) {
      throw new ValidationError("Укажите ожидаемую дату завершения");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      throw new ValidationError("Некорректная дата завершения");
    }

    return { title, status, dueDate };
  }

  #assertStatus(status) {
    if (!STATUSES.includes(status)) {
      throw new ValidationError("Некорректный статус задачи");
    }
  }

  #load() {
    if (!fs.existsSync(this.filePath)) {
      this.tasks = [];
      return;
    }
    const raw = fs.readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error("Файл задач повреждён: ожидается массив");
    }
    this.tasks = parsed;
  }

  #save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.tasks, null, 2), "utf8");
  }
}

module.exports = {
  TaskStore,
  ValidationError,
  NotFoundError,
  STATUSES,
};
