const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'zerodha',
  waitForConnections: true,
  connectionLimit: Number(process.env.MF_DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  decimalNumbers: true,
});

(async () => {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Mutual Fund MySQL connected:', process.env.DB_NAME || 'zerodha');
    conn.release();
  } catch (err) {
    console.error('❌ Mutual Fund MySQL connection failed:', err.message);
  }
})();

module.exports = pool;
