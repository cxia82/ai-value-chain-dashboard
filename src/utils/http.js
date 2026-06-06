const DEFAULT_TIMEOUT_MS = 4500;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const asHttpError = (message, details = {}) => Object.assign(new Error(message), details);

const isRetryableError = (error) => {
  if (!error) {
    return false;
  }
  if (error.retryable === true) {
    return true;
  }
  if (error.code === "TIMEOUT") {
    return true;
  }
  if (typeof error.status === "number") {
    return error.status === 429 || error.status >= 500;
  }
  return false;
};

export const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS, label = "request") => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw asHttpError(`${label} failed with status ${response.status}`, {
        code: `HTTP_${response.status}`,
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
        label
      });
    }

    return await response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw asHttpError(`${label} timed out after ${timeoutMs}ms`, {
        code: "TIMEOUT",
        retryable: true,
        label
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const fetchJsonWithRetry = async (url, options = {}, config = {}) => {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    label = "request",
    retries = 1,
    baseDelayMs = 120,
    maxDelayMs = 1200,
    shouldRetry = isRetryableError
  } = config;

  let attempt = 0;
  let lastError = null;

  while (attempt <= retries) {
    try {
      return await fetchJsonWithTimeout(url, options, timeoutMs, label);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < retries && shouldRetry(error);
      if (!canRetry) {
        break;
      }

      const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(backoff * 0.25)));
      await sleep(backoff + jitter);
      attempt += 1;
    }
  }

  throw lastError;
};
