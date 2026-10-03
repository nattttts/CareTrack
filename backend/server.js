const express = require("express");
const db = require("./database");

const app = express();
const PORT = 3000;

app.get("/", (req, res) => {
    res.send("CareTrack backend is working!");
});

app.listen(PORT, () => {
    console.log(`CareTrack server running at http://localhost:${PORT}`);
    console.log("SQLite database connected!");
});