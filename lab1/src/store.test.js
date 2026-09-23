const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TaskStore } = require("./store");

describe("TaskStore", () => {
  let dir;
  let store;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssp-tasks-"));
    store = new TaskStore(path.join(dir, "tasks.json"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("starts with an empty list", () => {
    assert.deepEqual(store.list(), []);
  });

  it("creates a task with title, status and due date", () => {
    const task = store.create({
      title: "Сдать лабораторную",
      status: "open",
      dueDate: "2026-09-20",
    });

    assert.equal(typeof task.id, "string");
    assert.ok(task.id.length > 0);
    assert.equal(task.title, "Сдать лабораторную");
    assert.equal(task.status, "open");
    assert.equal(task.dueDate, "2026-09-20");
    assert.deepEqual(task.files, []);
    assert.equal(store.list().length, 1);
  });

  it("persists tasks to disk and reloads them", () => {
    store.create({
      title: "Персистентность",
      status: "in_progress",
      dueDate: "2026-10-01",
    });

    const reloaded = new TaskStore(path.join(dir, "tasks.json"));
    assert.equal(reloaded.list().length, 1);
    assert.equal(reloaded.list()[0].title, "Персистентность");
  });

  it("rejects an empty title", () => {
    assert.throws(
      () =>
        store.create({
          title: "   ",
          status: "open",
          dueDate: "2026-09-20",
        }),
      /название/i
    );
  });

  it("rejects an unknown status", () => {
    assert.throws(
      () =>
        store.create({
          title: "Задача",
          status: "maybe",
          dueDate: "2026-09-20",
        }),
      /статус/i
    );
  });

  it("rejects a missing due date", () => {
    assert.throws(
      () =>
        store.create({
          title: "Задача",
          status: "open",
          dueDate: "",
        }),
      /дат/i
    );
  });

  it("filters tasks by status", () => {
    store.create({ title: "A", status: "open", dueDate: "2026-09-20" });
    store.create({ title: "B", status: "done", dueDate: "2026-09-21" });
    store.create({ title: "C", status: "done", dueDate: "2026-09-22" });

    const done = store.list("done");
    assert.equal(done.length, 2);
    assert.deepEqual(
      done.map((t) => t.title),
      ["B", "C"]
    );
    assert.equal(store.list("all").length, 3);
    assert.equal(store.list().length, 3);
  });

  it("returns a task by id", () => {
    const created = store.create({
      title: "Найти",
      status: "open",
      dueDate: "2026-09-20",
    });

    assert.equal(store.get(created.id).title, "Найти");
  });

  it("throws when task is not found", () => {
    assert.throws(() => store.get("missing-id"), /не найден/i);
  });

  it("updates title, status and due date", () => {
    const created = store.create({
      title: "Черновик",
      status: "open",
      dueDate: "2026-09-20",
    });

    const updated = store.update(created.id, {
      title: "Готово к сдаче",
      status: "done",
      dueDate: "2026-09-25",
    });

    assert.equal(updated.title, "Готово к сдаче");
    assert.equal(updated.status, "done");
    assert.equal(updated.dueDate, "2026-09-25");
  });

  it("deletes a task", () => {
    const created = store.create({
      title: "Удалить",
      status: "open",
      dueDate: "2026-09-20",
    });

    store.delete(created.id);
    assert.equal(store.list().length, 0);
  });

  it("attaches file metadata to a task", () => {
    const created = store.create({
      title: "С файлом",
      status: "open",
      dueDate: "2026-09-20",
    });

    const file = store.attachFile(created.id, {
      originalName: "notes.pdf",
      storedName: "abc-notes.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });

    assert.equal(typeof file.id, "string");
    assert.equal(file.originalName, "notes.pdf");
    assert.equal(store.get(created.id).files.length, 1);
  });

  it("removes file metadata from a task", () => {
    const created = store.create({
      title: "С файлом",
      status: "open",
      dueDate: "2026-09-20",
    });
    const file = store.attachFile(created.id, {
      originalName: "notes.pdf",
      storedName: "abc-notes.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });

    store.removeFile(created.id, file.id);
    assert.equal(store.get(created.id).files.length, 0);
  });

  it("throws when removing a missing file", () => {
    const created = store.create({
      title: "Без файла",
      status: "open",
      dueDate: "2026-09-20",
    });

    assert.throws(() => store.removeFile(created.id, "no-file"), /файл/i);
  });
});
