"use strict";

const path = require("path");
const express = require("express");

const app = express();
const port = process.env.WEB_PORT || 3184;

app.use("/", express.static(path.join(__dirname)));

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Web UI listening on http://localhost:${port}`);
});
