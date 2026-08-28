const REGISTRATION_TERMINAL_LOG_ENDPOINT = '/__trabawho_registration_log';
const MAX_LOG_BYTES = 64 * 1024;

const safeParseJson = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

module.exports = function setupProxy(app) {
  app.post(REGISTRATION_TERMINAL_LOG_ENDPOINT, (req, res) => {
    let rawBody = '';
    let bodyTooLarge = false;

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      rawBody += chunk;
      if (rawBody.length > MAX_LOG_BYTES) {
        bodyTooLarge = true;
        rawBody = rawBody.slice(0, MAX_LOG_BYTES);
      }
    });

    req.on('end', () => {
      const body = safeParseJson(rawBody) || {};
      const method = body.level === 'error' ? 'error' : body.level === 'warn' ? 'warn' : 'log';
      const eventName = body.eventName || 'unknown_event';
      const payload = body.payload || {};

      console[method](`[TrabaWho Registration Terminal] ${eventName}`, {
        ...payload,
        truncated: bodyTooLarge || undefined,
      });

      res.statusCode = 204;
      res.end();
    });

    req.on('error', (error) => {
      console.error('[TrabaWho Registration Terminal] log_forward_failed', {
        message: error.message,
      });
      res.statusCode = 204;
      res.end();
    });
  });
};
