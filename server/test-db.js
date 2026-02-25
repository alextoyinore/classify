import pkg from 'pg';
const { Client } = pkg;
import { config } from 'dotenv';
config();

async function test() {
    console.log('Testing connection with:', process.env.DATABASE_URL);
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });
    try {
        await client.connect();
        console.log('✅ Connection successful!');
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}
test();
