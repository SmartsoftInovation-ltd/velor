const path = require("path");

/**
 * Temp files that have been handed to the image worker.
 *
 * From the moment a file is queued, the worker owns it: it deletes the file
 * after the upload succeeds, or after the last retry fails. The upload
 * middleware's error cleanup must then leave it alone, even if the request
 * fails afterwards, or the worker's retries would find nothing to upload.
 */
const handedOff = new Set();

const key = (filePath) => path.resolve(String(filePath));

const markHandedOff = (filePath) => {
  if (filePath) handedOff.add(key(filePath));
};

/** True once, then forgotten: each request's cleanup asks about its own files once */
const takeHandedOff = (filePath) => handedOff.delete(key(filePath));

module.exports = { markHandedOff, takeHandedOff };
