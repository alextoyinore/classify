import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    console.log('--- Database Check ---');
    console.log('URL:', process.env.DATABASE_URL);

    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('✅ Connection Sucessful!');

        const res = await client.query('SELECT current_database(), current_user, version();');
        console.log('Current DB/User:', res.rows[0]);

        const schemas = await client.query("SELECT nspname FROM pg_namespace WHERE nspname = 'public';");
        console.log('Public Schema Exists:', schemas.rows.length > 0);

        console.log('Testing table creation...');
        await client.query('CREATE TABLE IF NOT EXISTS _prisma_test (id serial primary key);');
        console.log('✅ Table creation Sucessful!');
        await client.query('DROP TABLE _prisma_test;');

        await client.end();
    } catch (err) {
        console.error('❌ Database check failed:', err.message);
        if (err.stack) console.error(err.stack);
    }
}

check();
