class customError extends Error {
  /**
   * Create a new customError instance
   * @param {string} message - The error message
   * @param {number} statusCode - The HTTP status code
   * @param {string} [code] - Machine-readable error code for clients (e.g. "SMS_NOT_CONFIGURED")
   */
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    if (code) this.code = code;
    this.status =
      statusCode >= 400 && statusCode < 500 ? "Client Error " : "server error";
    this.isOperationalError = true;
    this.data = null;
    Error.captureStackTrace(this, customError);
  }
}

module.exports = { customError };
