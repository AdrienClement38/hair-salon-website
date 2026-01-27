
const fs = require('fs');
const path = require('path');

// Mocks
const mockSqliteRun = jest.fn();
const mockPgQuery = jest.fn();

jest.mock('sql.js', () => {
    return function () {
        return Promise.resolve({
            Database: jest.fn().mockImplementation(() => ({
                run: (...args) => {
                    // console.log('DEBUG: SQLite run called', args[0].substring(0, 20));
                    mockSqliteRun(...args);
                },
                exec: jest.fn(() => []),
                compile: jest.fn(),
                getRowsModified: jest.fn(() => 0),
                prepare: jest.fn(() => ({ run: jest.fn(), free: jest.fn(), bind: jest.fn(), step: jest.fn(), get: jest.fn() })),
                export: jest.fn()
            }))
        });
    };
});

jest.mock('pg', () => ({
    Pool: jest.fn().mockImplementation(() => ({
        query: (...args) => {
            // console.log('DEBUG: PG query called');
            mockPgQuery(...args);
            return Promise.resolve({ rows: [] });
        },
        connect: jest.fn()
    }))
}));

// Mock FS to avoid writing files during test
jest.mock('fs', () => {
    const actualFs = jest.requireActual('fs');
    return {
        ...actualFs,
        writeFileSync: jest.fn(),
        existsSync: jest.fn(() => false), // Pretend DB file doesn't exist to force init
        readFileSync: jest.fn(() => Buffer.from('')),
    };
});

describe('Database Schema Consistency', () => {

    function extractSchema(queries) {
        const schema = {};
        // Regex to find CREATE TABLE statements
        // Matches: CREATE TABLE [IF NOT EXISTS] [name] ( ... )
        const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)/i;

        // Flatten queries: split big strings by semicolon + newline or just semicolon
        const statements = [];
        queries.forEach(q => {
            if (typeof q === 'string') {
                q.split(';').forEach(stmt => {
                    const s = stmt.trim();
                    if (s) statements.push(s);
                });
            }
        });

        // console.log('DEBUG: Statements found:', statements.length);

        statements.forEach(stmt => {
            const match = createTableRegex.exec(stmt);
            if (match) {
                const tableName = match[1];
                // console.log('DEBUG: Found table', tableName);
                const cleanBody = match[2].trim();
                const columns = cleanBody.split(',').map(line => {
                    const parts = line.trim().split(/\s+/);
                    return parts[0];
                }).filter(col => col && !col.toUpperCase().startsWith('UNIQUE') && !col.toUpperCase().startsWith('PRIMARY') && !col.toUpperCase().startsWith('FOREIGN') && !col.toUpperCase().startsWith('CONSTRAINT'));

                if (!schema[tableName]) {
                    schema[tableName] = new Set();
                }
                columns.forEach(c => schema[tableName].add(c));
            }
        });

        // Also handle ALTER TABLE statements as corrections to the schema
        const alterTableRegex = /ALTER TABLE\s+(\w+)\s+ADD COLUMN\s+(?:IF NOT EXISTS\s+)?(\w+)/gi;

        queries.forEach(query => {
            if (typeof query !== 'string') return;
            let match;
            while ((match = alterTableRegex.exec(query)) !== null) {
                const tableName = match[1];
                const colName = match[2];
                // console.log('DEBUG: Altering table', tableName, 'add column', colName);
                if (schema[tableName]) {
                    schema[tableName].add(colName);
                }
            }
        });

        return schema;
    }

    async function getSqliteSchema() {
        jest.resetModules();
        process.env.NODE_ENV = 'test'; // Enforce test mode
        process.env.DB_TYPE = 'sqlite';
        mockSqliteRun.mockClear();

        const db = require('../server/models/database');
        await db.init().catch(e => console.error(e));

        // Collect all executed SQL
        const executedSql = mockSqliteRun.mock.calls.map(call => call[0]);
        return extractSchema(executedSql);
    }

    async function getPgSchema() {
        jest.resetModules();
        const oldEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production'; // Force non-test mode to bypass SQLite force
        process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
        process.env.DB_TYPE = 'pg';
        mockPgQuery.mockClear();

        try {
            const db = require('../server/models/database');
            await db.init().catch(e => console.error(e));

            // Collect all executed SQL
            const executedSql = mockPgQuery.mock.calls.map(call => call[0]);
            return extractSchema(executedSql);
        } finally {
            process.env.NODE_ENV = oldEnv; // Restore
            delete process.env.DATABASE_URL;
        }
    }

    // Normalize schema for comparison (Sets to sorted Arrays)
    function serializeSchema(schemaFuncResult) {
        const out = {};
        Object.keys(schemaFuncResult).sort().forEach(table => {
            out[table] = Array.from(schemaFuncResult[table]).sort();
        });
        return out;
    }

    test('SQLite and Postgres should have consistent schemas', async () => {
        const sqliteSchema = serializeSchema(await getSqliteSchema());
        const pgSchema = serializeSchema(await getPgSchema());

        // console.log('DEBUG SCHEMAS:', JSON.stringify({ sqlite: sqliteSchema, pg: pgSchema }, null, 2));

        const coreTables = ['admins', 'appointments', 'leaves', 'portfolio', 'images', 'settings'];

        coreTables.forEach(table => {
            expect(pgSchema[table]).toBeDefined();
            expect(sqliteSchema[table]).toBeDefined();
            expect(pgSchema[table]).toEqual(sqliteSchema[table]);
        });
    });
});
