const express = require("express");
const path = require("path");
const uploadroute = require("./routes/uploaders stuff/upload.js");
const indexrouter = require("./routes/normal human stuff/indexer.js");
const { router2, client, sendUserData, sendMessageToOwner } = require('./routes/normal human stuff/discord.js');
//require("dotenv").config();

const app = express();

app.use(uploadroute);
app.use(indexrouter);
app.use(router2);
// Serve static files
app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  next();
});

app.get("/message", async (req, res) => {
  res.send("Hello BrickPile User");
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

