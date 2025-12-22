const { z } = require('zod');

const validate = (schema) => (req, res, next) => {
    try {
        const parsed = schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });

        // Replace req properties with parsed (validated/transformed) values
        // This is optional but good practice to ensure we only use validated data
        // However, for partial validations (e.g. only body), we might lose other parts if not careful.
        // Zod's parse strips unknown keys by default only if configured.
        // Here we just validate.

        // Apply transformed values
        if (parsed.body) req.body = parsed.body;
        if (parsed.query) req.query = parsed.query;
        if (parsed.params) req.params = parsed.params;

        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation Error',
                details: err.issues.map(e => ({
                    path: e.path.join('.'),
                    message: e.message
                }))
            });
        }
        next(err);
    }
};

module.exports = validate;
