const { Client } = require('pg');
require('dotenv').config();
const client = new Client({
    user: process.env.POSTGRES_USER,
    host: process.env.DB_HOST,
    database: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT
});
client.connect()
    .then(() => client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"))
    .then(res => {
        console.log(res.rows);
        client.end();
    })
    .catch(e => console.error(e));
