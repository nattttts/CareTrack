const Database = require("better-sqlite3");

const db = new Database("../database/caretrack.db");

module.exports = db;