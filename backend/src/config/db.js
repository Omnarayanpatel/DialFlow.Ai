const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

let pool;

const getPool = () => {
  if (!pool) {
    if (!process.env.DB_URL) {
      throw new Error("DB_URL is not configured");
    }

    pool = new Pool({
      connectionString: process.env.DB_URL,
    });
  }

  return pool;
};

const query = async (text, params = []) => {
  const client = getPool();
  return client.query(text, params);
};

const withTransaction = async (callback) => {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const runSchema = async () => {
  const schemaPath = path.resolve(__dirname, "../../../database/schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  if (!schemaSql.trim()) {
    return;
  }

  await query(schemaSql);
};

const connectDB = async () => {
  const client = getPool();
  await client.query("SELECT 1");
  await runSchema();
  console.log("PostgreSQL connected successfully");
};

module.exports = {
  connectDB,
  query,
  withTransaction,
};
