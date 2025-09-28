
const express = require("express");
const path = require("path");
const app = express();

app.use(express.static(".", { extensions: ["html"], maxAge: "1h", index: "index.html" }));
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`So Jobless BH web running on :${port}`));
