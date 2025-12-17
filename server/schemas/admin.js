const { z } = require('zod');

// Base validators
const safeString = (min = 1, max = 255) => z.string()
    .min(min, `Doit contenir au moins ${min} caractère(s)`)
    .max(max, `Doit contenir au maximum ${max} caractères`)
    .regex(/^[^<>]*$/, "Les caractères < et > sont interdits (XSS prevention)")
    .regex(/^[^;]*$/, "Le caractère ; est interdit (SQL prevention)"); // Basic anti-SQLi for sensitive fields

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const loginSchema = z.object({
    body: z.object({
        username: safeString(1, 100),
        password: z.string().min(1, "Mot de passe requis") // Don't restrict password chars, they are hashed
    })
});

const workerSchema = z.object({
    body: z.object({
        username: safeString(3, 50),
        displayName: safeString(2, 50),
        password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères")
    })
});

const updateWorkerSchema = z.object({
    params: z.object({
        id: z.string().or(z.number())
    }),
    body: z.object({
        displayName: safeString(2, 50).optional(),
        password: z.string().min(6).optional().or(z.literal(''))
    })
});

const leaveSchema = z.object({
    body: z.object({
        start_date: z.string().regex(dateRegex, "Format de date invalide (YYYY-MM-DD)"),
        end_date: z.string().regex(dateRegex, "Format de date invalide (YYYY-MM-DD)"),
        note: safeString(0, 500).optional(), // Note can be empty
        admin_id: z.number().optional()
    })
});

module.exports = {
    loginSchema,
    workerSchema,
    updateWorkerSchema,
    leaveSchema
};
