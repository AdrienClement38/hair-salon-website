const { z } = require('zod');

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createBookingSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        date: z.string().regex(dateRegex, "Format de date invalide (YYYY-MM-DD)"),
        time: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
        service: z.string().min(1, "Le service est requis"),
        phone: z.string().optional().nullable().refine((val) => {
            if (!val) return true;
            // Remove spaces, dots, dashes
            const clean = val.replace(/[\s.-]/g, '');
            // Check format: 
            // ^(?:(?:\+|00)33|0) -> Starts with +33, 0033 or 0
            // [1-9] -> Next char is 1-9 (excludes 0)
            // \d{8}$ -> 8 digits after
            return /^(?:(?:\+|00)33|0)[1-9]\d{8}$/.test(clean);
        }, "Numéro invalide (doit contenir 10 chiffres, ex: 0612345678)"),
        adminId: z.preprocess(
            (val) => {
                if (val === "" || val === null || val === undefined) return null;
                const n = Number(val);
                return isNaN(n) ? null : n;
            },
            z.number().optional().nullable()
        )
    })
});

const updateBookingSchema = z.object({
    body: z.object({
        time: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)")
    }),
    params: z.object({
        id: z.string().or(z.number()).transform(val => Number(val))
    })
});

module.exports = {
    createBookingSchema,
    updateBookingSchema
};
