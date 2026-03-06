class ErrorHandler extends Error {
  constructor(statusCode = 400, message = "Unexpected error", details) {
    super(message);

    this.name = "ErrorHandler";
    this.statusCode = Number.isInteger(statusCode) ? statusCode : 500;
    this.details = details && typeof details === "object" ? details : undefined;
    this.isOperational = true;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default ErrorHandler;
