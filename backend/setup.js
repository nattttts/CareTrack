
const fs = require("fs");
const path = require("path");
const db = require("./database");

// Read the SQL schema file
const schemaPath = path.join(
    __dirname,
    "../database/schema.sql"
);

const schema = fs.readFileSync(schemaPath, "utf8");

// Create the tables
db.exec(schema);

console.log("Database schema executed successfully!");

// List the tables in the database
const tables = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name
`).all();

console.log("\nTables created:");

tables.forEach((table) => {
    console.log(`- ${table.name}`);
});

// Check foreign-key violations
const violations = db.pragma("foreign_key_check");

if (violations.length === 0) {
    console.log("\nForeign-key check passed!");
} else {
    console.log("\nForeign-key violations found:");
    console.log(violations);
}

db.close();
