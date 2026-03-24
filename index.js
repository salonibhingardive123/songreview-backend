const express = require("express");
const cors = require("cors");
//const bodyParser = require("body-parser");
const { CosmosClient } = require("@azure/cosmos");

const app = express();
app.use(cors());
app.use(express.json());

// 🔴 PASTE YOUR VALUES HERE
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });

const databaseId = "reviews-db";
const containerId = "reviews";

// Ensure DB + container exist (SAFE)
async function init() {
  const { database } = await client.databases.createIfNotExists({
    id: databaseId
  });

  const { container } = await database.containers.createIfNotExists({
    id: containerId,
    partitionKey: { paths: ["/songName"] }
  });

  return container;
}

let container;

// Initialize
init().then((c) => {
  container = c;
  console.log("Connected to Cosmos DB");
});

// POST review
app.post("/reviews", async (req, res) => {
  try {
    const data = req.body;

    const avg =
      (data.lyrics +
        data.vocals +
        data.composition +
        data.melody +
        data.music) / 5;

    const newItem = {
      id: Date.now().toString(),
      songName: data.songName,
      lyrics: data.lyrics,
      vocals: data.vocals,
      composition: data.composition,
      melody: data.melody,
      music: data.music,
      average: avg,
      createdAt: new Date().toISOString()
    };

    const { resource } = await container.items.create(newItem);
    res.json(resource);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// GET latest 5 reviews
app.get("/reviews", async (req, res) => {
  try {
    const querySpec = {
      query: "SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 5"
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    res.json(resources);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
