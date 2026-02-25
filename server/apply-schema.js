import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

async function applySchema() {
    const sql = fs.readFileSync('schema_utf8.sql', 'utf8').replace(/^\uFEFF/, '');
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        // Split by semicolon but be careful with enums and multiline
        // Actually, just execute the whole thing if the driver supports it
        // Or split by '-- Create' blocks roughly

        await client.query(sql);
        console.log('✅ Schema applied successfully!');

    } catch (err) {
        console.error('❌ Failed to apply schema:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.where) console.error('Where:', err.where);
    } finally {
        await client.end();
    }
}

applySchema();
