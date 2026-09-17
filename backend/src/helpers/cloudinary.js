const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const integrationConfig = require("../integrations/config");

// Credentials are resolved per call (the current tenant's Cloudinary account, or
// the legacy env account) and passed in the request options. Never call
// cloudinary.config() with credentials: one process serves many tenants.

const credentials = async () => {
  const { cloud_name, api_key, api_secret, folder } = await integrationConfig.getCloudinaryConfig();
  return { auth: { cloud_name, api_key, api_secret }, folder };
};

/**
 * Uploads a file to the current tenant's Cloudinary account.
 *
 * @param {string} localFilePath - Path to the local temp file.
 * @param {object} [options]
 * @param {boolean} [options.deleteAfter=true] - Delete local file after upload.
 *   Pass `false` when called from a BullMQ worker that manages its own cleanup
 *   across retries — the file must survive until the job succeeds or exhausts attempts.
 * @returns {Promise<{result: object, optimizeUrl: string, cloudName: string}|null>}
 *   null when the upload itself failed; throws when Cloudinary is not configured.
 */
const cloudinaryFileUpload = async (localFilePath, { deleteAfter = true } = {}) => {
  if (!localFilePath || !fs.existsSync(localFilePath)) return null;

  const { auth, folder } = await credentials();

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      ...auth,
      ...(folder ? { folder } : {}),
      resource_type: "auto",
    });

    const optimizeUrl = cloudinary.url(result.public_id, {
      ...auth,
      secure: true,
      fetch_format: "auto",
      resource_type: "image",
      quality: "auto",
      transformation: [
        { width: 1024, crop: "limit" },
        { quality: "auto:low" },
        { fetch_format: "auto" },
      ],
    });

    if (deleteAfter) fs.unlinkSync(localFilePath);

    return { result, optimizeUrl, cloudName: auth.cloud_name };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);
    if (deleteAfter && fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
    return null;
  }
};

/**
 * Deletes a file from the current tenant's Cloudinary account.
 * When the asset was uploaded to a different account (cloudName differs), the
 * delete is skipped — those credentials are no longer available.
 */
const deleteCloudinaryFile = async (publicId, cloudName) => {
  if (!publicId) return null;

  const { auth } = await credentials();
  if (cloudName && cloudName !== auth.cloud_name) {
    console.log(`Cloudinary delete skipped: ${publicId} belongs to account "${cloudName}"`);
    return { skipped: true };
  }

  try {
    const result = await cloudinary.api.delete_resources([publicId], {
      ...auth,
      type: "upload",
      resource_type: "image",
    });
    console.log("Cloudinary Delete Result:", result);
    return result;
  } catch (error) {
    console.error("Cloudinary Delete Error:", error.message);
    return null;
  }
};

// Upload a barcode (base64 data URI) to the current tenant's Cloudinary account
const uploadBarcodeToCloudinary = async (barcodeBase64) => {
  if (!barcodeBase64) return null;

  const { auth, folder } = await credentials();

  try {
    const result = await cloudinary.uploader.upload(barcodeBase64, {
      ...auth,
      ...(folder ? { folder } : {}),
      resource_type: "image",
      format: "png",
      transformation: [
        { width: 512, crop: "limit" },
        { quality: "auto:low" },
        { fetch_format: "auto" },
      ],
    });

    const optimizeUrl = cloudinary.url(result.public_id, {
      ...auth,
      secure: true,
      fetch_format: "auto",
      quality: "auto",
    });

    return { result, optimizeUrl, cloudName: auth.cloud_name };
  } catch (error) {
    console.error("Cloudinary Barcode Upload Error:", error.message);
    return null;
  }
};

module.exports = {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
  uploadBarcodeToCloudinary,
};
