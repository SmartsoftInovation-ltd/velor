const multer = require("multer");
const path = require("path");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const fs = require("fs");
const { getTenantId } = require("../tenancy/context");
const settings = require("../settings/settings.service");
const { AsyncResource } = require("async_hooks");
const { takeHandedOff } = require("../queues/uploadHandoff");

// Multer calls back from busboy's stream events, which run outside the request's
// AsyncLocalStorage scope: without this the store's tenant is lost, the upload
// guard skips its check and the controller's queries throw TENANT_CONTEXT_REQUIRED.
const keepTenant = (callback) => AsyncResource.bind(callback);

// Every file multer saved for this request, whichever wrapper was used
const filesOf = (req) => [
  ...(req.file ? [req.file] : []),
  ...(Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat()),
];

const removeFiles = (files) =>
  Promise.all(files.map((file) => fs.promises.unlink(file.path).catch(() => {})));

/**
 * Deletes this request's temp files when it ends in an error.
 *
 * On success the image worker uploads the file and deletes it. But a request
 * can fail after multer has written the file (validation, a duplicate title,
 * a database error), and then no job is queued and the file stays in
 * public/temp for good. Error responses are where those leftovers come from,
 * so they are cleaned up here, once, for every upload route. A file that
 * was already queued is skipped: from then on the worker owns it.
 */
const cleanUpOnError = (req, res) => {
  res.once("finish", () => {
    // A file already queued belongs to the image worker, which deletes it
    // itself after the upload, or after its last retry
    const files = filesOf(req).filter((file) => !takeHandedOff(file.path));
    if (res.statusCode >= 400) removeFiles(files);
  });
};

// Uploaded files are pushed to the tenant's Cloudinary account in the background.
// Reject them up front when that account is not configured, so the record is not
// saved with an image that can never upload.
const guardUploads = async (req, next) => {
  const files = filesOf(req);
  const tenantId = getTenantId();
  if (!files.length || !tenantId) return next();

  try {
    const { cloudinary } = await settings.getFeatures(tenantId);
    if (cloudinary) return next();
    await removeFiles(files);
    next(settings.featureNotConfigured("CLOUDINARY_NOT_CONFIGURED", "Image storage (Cloudinary)"));
  } catch (error) {
    next(error);
  }
};

// Allowed file types
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = path.basename(file.originalname, ext);
    cb(null, `${filename}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    const error = new Error(
      "Only image files (JPG, JPEG, PNG, WEBP) are allowed. GIFs and videos are not accepted.",
    );
    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 15MB max size
  },
});

/**
 * One error shape for every upload wrapper. Multer's own errors (file too
 * large, unexpected field) and the file-type rejection are the client's (400);
 * the type rejection already carried statusCode 400, but the wrappers re-raised
 * every error as a 500. Anything else is a genuine server error.
 */
const uploadError = (err) => {
  if (err instanceof multer.MulterError) {
    return new customError(
      "Multer error: " + (err.message || "File upload error"),
      statusCodes.BAD_REQUEST,
    );
  }
  return new customError(
    err.message || "File upload error",
    err.statusCode || statusCodes.SERVER_ERROR,
  );
};

const withUploadErrors = (uploader) => (req, res, next) => {
  cleanUpOnError(req, res);
  return uploader(req, res, keepTenant(function (err) {
    if (err) {
      console.error("File upload error:", err);
      return next(uploadError(err));
    }
    guardUploads(req, next);
  }));
};

/**
 * Middleware wrapper for single file upload with clean error handling
 */
const singleFileUpload = (fieldName) => withUploadErrors(upload.single(fieldName));

/**
 * Middleware wrapper for multiple file upload with clean error handling
 */
const multipleFileUpload = (fieldName, maxCount = 1) =>
  withUploadErrors(upload.array(fieldName, maxCount));

// make a another funtion using upload.fields to upload multiple files with different field names
const multipleFileUploadWithFields = (fields) => withUploadErrors(upload.fields(fields));

const anyFileUpload = () => withUploadErrors(upload.any());

// Export the middleware functions

module.exports = {
  singleFileUpload,
  multipleFileUpload,
  multipleFileUploadWithFields,
  anyFileUpload,
};
