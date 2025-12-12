const { z } = require('zod');

const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createBookingSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
        date: z.string().regex(dateRegex, "Format de date invalide (YYYY-MM-DD)"),
        time: z.string().regex(timeRegex, "Format d'heure invalide (HH:MM)"),
        service: z.string().min(1, "Le service est requis"),
        phone: z.string().optional().nullable(),
        adminId: z.number().optional().nullable() // For multi-admin support
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
