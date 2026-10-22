const fs = require("fs");
const path = require("path");
const express = require("express");
const request = require("supertest");
const { singleFileUpload } = require("../../src/middleware/multer.middleware");
const { markHandedOff } = require("../../src/queues/uploadHandoff");

/**
 * !-*+++++++++++++++++++++`
 * A request that saved an upload but then failed (validation, duplicate,
 * database error) queues no worker job, so nothing else would ever delete
 * its temp file. The upload middleware removes it when the response is an error.
 */
describe("upload temp files", () => {
  const TEMP = path.resolve("public/temp");
  const PNG = Buffer.from("89504e470d0a1a0a", "hex");
  const marker = () =>
    `cleanup-test-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const tempFilesNamed = (name) =>
    fs.readdirSync(TEMP).filter((f) => f.startsWith(name));

  const app = express();
  app.post("/fails", singleFileUpload("image"), (req, res) =>
    res.status(400).json({ message: "Title is required" }),
  );
  app.post("/works", singleFileUpload("image"), (req, res) =>
    res.status(201).json({ path: req.file.path }),
  );
  // Queued for the worker, then the request fails (e.g. a cache error after enqueue)
  app.post("/queued-then-fails", singleFileUpload("image"), (req, res) => {
    markHandedOff(req.file.path);
    res.status(500).json({ path: req.file.path });
  });

  it("deletes the file when the request fails", async () => {
    const name = marker();
    await request(app)
      .post("/fails")
      .attach("image", PNG, `${name}.png`)
      .expect(400);
    // The cleanup runs after the response is sent
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tempFilesNamed(name)).toEqual([]);
  });

  it("keeps the file for the image worker when the request succeeds", async () => {
    const name = marker();
    const res = await request(app)
      .post("/works")
      .attach("image", PNG, `${name}.png`)
      .expect(201);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tempFilesNamed(name)).toHaveLength(1);
    fs.unlinkSync(res.body.path);
  });

  it("leaves a file the image worker already owns, even when the request then fails", async () => {
    const name = marker();
    const res = await request(app)
      .post("/queued-then-fails")
      .attach("image", PNG, `${name}.png`)
      .expect(500);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(tempFilesNamed(name)).toHaveLength(1);
    fs.unlinkSync(res.body.path);
  });
});
