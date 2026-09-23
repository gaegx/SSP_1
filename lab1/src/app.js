const express = require("express");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const multer = require("multer");
const { ValidationError, NotFoundError, STATUSES } = require("./store");

const STATUS_LABELS = {
  open: "К выполнению",
  in_progress: "В работе",
  done: "Выполнена",
};

function formatDate(iso) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function handle(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function createApp({ store, uploadsDir }) {
  if (!store) {
    throw new Error("store is required");
  }
  if (!uploadsDir) {
    throw new Error("uploadsDir is required");
  }

  fs.mkdirSync(uploadsDir, { recursive: true });

  const app = express();
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

  app.use(express.urlencoded({ extended: false }));
  app.use("/static", express.static(path.join(__dirname, "..", "public")));

  const upload = multer({
    storage: multer.diskStorage({
      destination(_req, _file, cb) {
        cb(null, uploadsDir);
      },
      filename(_req, file, cb) {
        cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  function issueKey(task) {
    const index = store.list().findIndex((item) => item.id === task.id);
    return `LAB-${index + 1}`;
  }

  function locals(extra) {
    return {
      statuses: STATUSES,
      statusLabels: STATUS_LABELS,
      formatDate,
      issueKey,
      filterStatus: null,
      error: null,
      ...extra,
    };
  }

  function storedPath(storedName) {
    return path.join(uploadsDir, storedName);
  }

  function unlinkStored(storedName) {
    fs.unlinkSync(storedPath(storedName));
  }

  app.get(
    "/",
    handle((req, res) => {
      const filterStatus = req.query.status || "all";
      const tasks = filterStatus === "all" ? store.list() : store.list(filterStatus);
      res.render(
        "index",
        locals({
          title: "Задачи",
          tasks,
          filterStatus,
          form: { title: "", status: "open", dueDate: "" },
        })
      );
    })
  );

  app.post(
    "/tasks",
    handle((req, res) => {
      try {
        store.create({
          title: req.body.title,
          status: req.body.status,
          dueDate: req.body.dueDate,
        });
        res.redirect(302, "/");
      } catch (err) {
        if (!(err instanceof ValidationError)) {
          throw err;
        }
        const filterStatus = "all";
        res.status(400).render(
          "index",
          locals({
            title: "Задачи",
            tasks: store.list(),
            filterStatus,
            error: err.message,
            form: {
              title: req.body.title || "",
              status: req.body.status || "open",
              dueDate: req.body.dueDate || "",
            },
          })
        );
      }
    })
  );

  app.get(
    "/tasks/:id",
    handle((req, res) => {
      const task = store.get(req.params.id);
      res.render(
        "task",
        locals({
          title: task.title,
          task,
        })
      );
    })
  );

  app.post(
    "/tasks/:id",
    handle((req, res) => {
      try {
        store.update(req.params.id, {
          title: req.body.title,
          status: req.body.status,
          dueDate: req.body.dueDate,
        });
        res.redirect(302, `/tasks/${req.params.id}`);
      } catch (err) {
        if (!(err instanceof ValidationError)) {
          throw err;
        }
        const task = store.get(req.params.id);
        res.status(400).render(
          "task",
          locals({
            title: task.title,
            task: {
              ...task,
              title: req.body.title,
              status: req.body.status,
              dueDate: req.body.dueDate,
            },
            error: err.message,
          })
        );
      }
    })
  );

  app.post(
    "/tasks/:id/delete",
    handle((req, res) => {
      const task = store.get(req.params.id);
      for (const file of task.files) {
        unlinkStored(file.storedName);
      }
      store.delete(req.params.id);
      res.redirect(302, "/");
    })
  );

  app.post(
    "/tasks/:id/files",
    upload.single("attachment"),
    handle((req, res) => {
      if (!req.file) {
        throw new ValidationError("Выберите файл для вложения");
      }

      try {
        store.attachFile(req.params.id, {
          originalName: req.file.originalname,
          storedName: req.file.filename,
          mimeType: req.file.mimetype,
          size: req.file.size,
        });
      } catch (err) {
        fs.unlinkSync(req.file.path);
        throw err;
      }

      res.redirect(302, `/tasks/${req.params.id}`);
    })
  );

  app.get(
    "/tasks/:id/files/:fileId",
    handle((req, res) => {
      const task = store.get(req.params.id);
      const file = task.files.find((item) => item.id === req.params.fileId);
      if (!file) {
        throw new NotFoundError("Файл не найден");
      }
      res.download(storedPath(file.storedName), file.originalName);
    })
  );

  app.post(
    "/tasks/:id/files/:fileId/delete",
    handle((req, res) => {
      const file = store.removeFile(req.params.id, req.params.fileId);
      unlinkStored(file.storedName);
      res.redirect(302, `/tasks/${req.params.id}`);
    })
  );

  app.use((req, res) => {
    res.status(404).render(
      "404",
      locals({
        title: "Страница не найдена",
        message: "Такой страницы нет.",
      })
    );
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof NotFoundError) {
      res.status(404).render(
        "404",
        locals({
          title: "Не найдено",
          message: err.message,
        })
      );
      return;
    }

    if (err instanceof ValidationError || err instanceof multer.MulterError) {
      res.status(400).render(
        "404",
        locals({
          title: "Ошибка запроса",
          message: err.message,
        })
      );
      return;
    }

    console.error(err);
    res.status(500).render(
      "404",
      locals({
        title: "Ошибка сервера",
        message: "Не удалось обработать запрос.",
      })
    );
  });

  return app;
}

module.exports = { createApp, STATUS_LABELS, formatDate };
