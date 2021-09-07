// const express = require('express');
// const bodyParser = require('body-parser');

// const app = express();
// const port = process.env.PORT || 5000;

const express = require("express");
const bodyParser = require("body-parser");
const multer = require("multer");
const request = require("request");

const path = require("path");
const fs = require("fs").promises;

const videos = require("./videos");
const events = require("./events");
const actions = require("./actions");
const scenes = require("./scenes");
const { setup, checkLoginMiddleware, authHandler } = require("./auth");
// const projects = require('./queries/projects');
// const images = require('./queries/images');
// const mlmodels = require('./queries/mlmodels');
// const exporter = require('./exporter');
// const importer = require('./importer');
// const { setup, checkLoginMiddleware, authHandler } = require('./auth');

const UPLOADS_PATH =
  process.env.UPLOADS_PATH || path.join(__dirname, "..", "uploads");

const app = express();

setup(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// const uploads = multer({
//   storage: multer.diskStorage({
//     destination: async (req, file, cb) => {
//       const { projectId } = req.params;
//       try {
//         if (!projects.get(projectId)) {
//           throw new Error("No such projectId.");
//         }
//         const dest = path.join(UPLOADS_PATH, projectId);
//         try {
//           await fs.mkdir(dest);
//         } catch (err) {}
//         cb(null, dest);
//       } catch (err) {
//         cb(err);
//       }
//     },
//     filename: (req, file, cb) => {
//       try {
//         const { projectId } = req.params;
//         const filename = file.originalname;

//         if (req.reference) {
//           const ext = path.extname(filename);
//           const name = `_reference${ext}`;
//           const referenceLink = `/uploads/${projectId}/${name}`;
//           projects.updateReference(projectId, referenceLink);
//           cb(null, name);
//         } else {
//           const id = images.addImageStub(projectId, filename, null);
//           const newName = images.updateLink(id, { projectId, filename });
//           cb(null, newName);
//         }
//       } catch (err) {
//         cb(err);
//       }
//     }
//   })
// });

// app.post('/api/uploads/:projectId', uploads.array('videos'), (req, res) => {
//     res.json({ success: true });
// })

app.get("/api/auth", authHandler);

app.post("/api/start", (req, res) => {
  const { videoName } = req.body;
  console.log("api start", videoName);
  const entry = videos.getByVideoName(videoName);
  if (entry.length > 0) {
    console.log("already added,", entry);
    res.json({ success: true, message: entry });
  } else {
    res.json({ success: true, message: "no entry" });
  }
});

app.post("/api/save", (req, res) => {
  const { id, videoName, jsonName, currentJson } = req.body;
  if (!id) {
    const id = videos.addSession(videoName, jsonName, currentJson);
    console.log("added entry with id", id);
    res.json({ success: true, message: id });
  } else {
    videos.updateSession(id, videoName, jsonName, currentJson);
    console.log("updated entry with id", id);
    res.json({ success: true, message: currentJson });
  }
  // console.log(videos.getAll());
});

app.get("/api/videos", checkLoginMiddleware, (req, res) => {
  const entries = videos.getAll();
  res.json({ success: true, message: entries });
});

app.get("/api/events", (req, res) => {
  const entries = events.getAll();
  res.json({ success: true, message: entries });
});

app.post("/api/events/delete", checkLoginMiddleware, (req, res) => {
  const { id } = req.body;
  events.toggleDelete(id);
  res.json({ success: true });
});

app.post("/api/events/rename", checkLoginMiddleware, (req, res) => {
  const { id, newName } = req.body;
  events.rename(newName, id);
  res.json({ success: true });
});

app.post("/api/events/rename-bulk", checkLoginMiddleware, (req, res) => {
  const { renames } = req.body;
  Object.keys(renames).forEach(id => events.rename(renames[id], id));
  res.json({ success: true });
  // console.log(events.getAll());
});

app.post("/api/events/add", checkLoginMiddleware, (req, res) => {
  const { name } = req.body;
  events.add(name);
  res.json({ success: true });
});

app.get("/api/scenes", (req, res) => {
  const entries = scenes.getAll();
  res.json({ success: true, message: entries });
});

app.post("/api/scenes/delete", checkLoginMiddleware, (req, res) => {
  const { id } = req.body;
  scenes.toggleDelete(id);
  res.json({ success: true });
});

app.post("/api/scenes/rename", checkLoginMiddleware, (req, res) => {
  const { id, newName } = req.body;
  scenes.rename(newName, id);
  res.json({ success: true });
});

app.post("/api/scenes/rename-bulk", checkLoginMiddleware, (req, res) => {
  const { renames } = req.body;
  Object.keys(renames).forEach(id => scenes.rename(renames[id], id));
  res.json({ success: true });
  // console.log(scenes.getAll());
});

app.post("/api/scenes/add", checkLoginMiddleware, (req, res) => {
  const { name } = req.body;
  scenes.add(name);
  res.json({ success: true });
});

app.get("/api/actions", (req, res) => {
  const entries = actions.getAll();
  res.json({ success: true, message: entries });
});

app.post("/api/actions/delete", checkLoginMiddleware, (req, res) => {
  const { id } = req.body;
  actions.toggleDelete(id);
  res.json({ success: true });
});

app.post("/api/actions/rename", checkLoginMiddleware, (req, res) => {
  const { id, newName } = req.body;
  actions.rename(newName, id);
  res.json({ success: true });
});

app.post("/api/actions/rename-bulk", (req, res) => {
  const { renames } = req.body;
  Object.keys(renames).forEach(id => actions.rename(renames[id], id));
  res.json({ success: true });
  // console.log(actions.getAll());
});

app.post("/api/actions/add", (req, res) => {
  const { name } = req.body;
  actions.add(name);
  res.json({ success: true });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../../client/build")));
  app.get("*", (req, res, next) => {
    if (req.url.startsWith("/api/")) return next();
    if (req.url.startsWith("/uploads/")) return next();
    res.sendFile(path.join(__dirname + "/../../client/build/index.html"));
  });
}

const PORT = process.env.API_PORT || process.env.PORT || 3001;

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
