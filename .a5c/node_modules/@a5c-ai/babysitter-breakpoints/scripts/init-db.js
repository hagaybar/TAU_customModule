"use strict";

const { openDb, initDb, DB_PATH } = require("../api/db");

async function main() {
  const db = openDb();
  try {
    await initDb(db);
    // eslint-disable-next-line no-console
    console.log(`Database initialized at ${DB_PATH}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
