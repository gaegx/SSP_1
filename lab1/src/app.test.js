const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");
const { createApp } = require("./app");
const { TaskStore } = require("./store");

describe("SSR task app", () => {
  let dir;
  let uploadsDir;
  let app;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssp-app-"));
    uploadsDir = path.join(dir, "uploads");
    fs.mkdirSync(uploadsDir);
    app = createApp({
      store: new TaskStore(path.join(dir, "tasks.json")),
      uploadsDir,
    });
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("renders the task list as HTML with a create form", async () => {
    const res = await request(app).get("/").expect(200);

    assert.match(res.headers["content-type"], /html/);
    assert.match(res.text, /<form[^>]*method="post"/i);
    assert.match(res.text, /action="\/tasks"/i);
    assert.match(res.text, /name="title"/);
    assert.match(res.text, /name="status"/);
    assert.match(res.text, /name="dueDate"/);
    assert.match(res.text, /name="status"[^>]*form="filter-form"|<form[^>]*id="filter-form"/i);
  });

  it("creates a task from a form post and shows it in the list", async () => {
    const create = await request(app)
      .post("/tasks")
      .type("form")
      .send({
        title: "Подготовить отчёт",
        status: "open",
        dueDate: "2026-09-20",
      })
      .expect(302);

    assert.equal(create.headers.location, "/");

    const list = await request(app).get("/").expect(200);
    assert.match(list.text, /Подготовить отчёт/);
    assert.match(list.text, /2026-09-20|20\.09\.2026/);
  });

  it("filters the list by status via query string from the filter form", async () => {
    await request(app).post("/tasks").type("form").send({
      title: "Открытая",
      status: "open",
      dueDate: "2026-09-20",
    });
    await request(app).post("/tasks").type("form").send({
      title: "Готовая",
      status: "done",
      dueDate: "2026-09-21",
    });

    const res = await request(app).get("/").query({ status: "done" }).expect(200);
    assert.match(res.text, /Готовая/);
    assert.doesNotMatch(res.text, /Открытая/);
  });

  it("re-renders the list with an error when title is missing", async () => {
    const res = await request(app)
      .post("/tasks")
      .type("form")
      .send({
        title: "  ",
        status: "open",
        dueDate: "2026-09-20",
      })
      .expect(400);

    assert.match(res.headers["content-type"], /html/);
    assert.match(res.text, /название/i);
  });

  it("renders a task page with edit and file upload forms", async () => {
    const store = new TaskStore(path.join(dir, "tasks.json"));
    const task = store.create({
      title: "Карточка",
      status: "in_progress",
      dueDate: "2026-09-22",
    });
    app = createApp({ store, uploadsDir });

    const res = await request(app).get(`/tasks/${task.id}`).expect(200);
    assert.match(res.text, /Карточка/);
    assert.match(res.text, /<form[^>]*method="post"/i);
    assert.match(res.text, /enctype="multipart\/form-data"/i);
    assert.match(res.text, /name="attachment"/);
  });

  it("attaches a file through a multipart form and allows download", async () => {
    const store = new TaskStore(path.join(dir, "tasks.json"));
    const task = store.create({
      title: "С вложением",
      status: "open",
      dueDate: "2026-09-20",
    });
    app = createApp({ store, uploadsDir });

    const attach = await request(app)
      .post(`/tasks/${task.id}/files`)
      .attach("attachment", Buffer.from("hello lab"), {
        filename: "notes.txt",
        contentType: "text/plain",
      })
      .expect(302);

    assert.equal(attach.headers.location, `/tasks/${task.id}`);

    const page = await request(app).get(`/tasks/${task.id}`).expect(200);
    assert.match(page.text, /notes\.txt/);

    const fileId = store.get(task.id).files[0].id;
    const download = await request(app)
      .get(`/tasks/${task.id}/files/${fileId}`)
      .expect(200);

    assert.equal(download.text, "hello lab");
    assert.match(download.headers["content-disposition"], /notes\.txt/);
  });

  it("updates a task from its edit form", async () => {
    const store = new TaskStore(path.join(dir, "tasks.json"));
    const task = store.create({
      title: "Старое имя",
      status: "open",
      dueDate: "2026-09-20",
    });
    app = createApp({ store, uploadsDir });

    await request(app)
      .post(`/tasks/${task.id}`)
      .type("form")
      .send({
        title: "Новое имя",
        status: "done",
        dueDate: "2026-09-30",
      })
      .expect(302);

    const page = await request(app).get(`/tasks/${task.id}`).expect(200);
    assert.match(page.text, /Новое имя/);
    assert.doesNotMatch(page.text, /Старое имя/);
  });

  it("deletes a task from a form post", async () => {
    const store = new TaskStore(path.join(dir, "tasks.json"));
    const task = store.create({
      title: "На удаление",
      status: "open",
      dueDate: "2026-09-20",
    });
    app = createApp({ store, uploadsDir });

    await request(app).post(`/tasks/${task.id}/delete`).type("form").send({}).expect(302);

    await request(app).get(`/tasks/${task.id}`).expect(404);
    const list = await request(app).get("/").expect(200);
    assert.doesNotMatch(list.text, /На удаление/);
  });

  it("returns 404 HTML for an unknown task", async () => {
    const res = await request(app).get("/tasks/missing").expect(404);
    assert.match(res.headers["content-type"], /html/);
  });
});
