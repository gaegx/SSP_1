const path = require("node:path");
const fs = require("node:fs");
const { createApp } = require("./app");
const { TaskStore } = require("./store");

const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(rootDir, "uploads");
const dataFile = path.join(rootDir, "data", "tasks.json");

fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(path.dirname(dataFile), { recursive: true });

const app = createApp({
  store: new TaskStore(dataFile),
  uploadsDir,
});

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`SSR tasks: http://localhost:${port}`);
});
