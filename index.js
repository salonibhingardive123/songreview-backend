

const express = require("express");
const cors = require("cors");
const { CosmosClient } = require("@azure/cosmos");

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables (Azure App Service settings)
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

if (!endpoint || !key) {
  console.error("Missing Cosmos DB environment variables");
  process.exit(1);
}

const client = new CosmosClient({ endpoint, key });

const databaseId = "reviews-db";
const containerId = "reviews";

let container;

// Initialize Cosmos DB safely before starting server
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

// POST /reviews
app.post("/reviews", async (req, res) => {
  try {
    const data = req.body;

    if (!container) {
      return res.status(503).send("Service not ready");
    }

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
    console.error("POST /reviews error:", err);
    res.status(500).send(err.message);
  }
});

// GET /reviews
app.get("/reviews", async (req, res) => {
  try {
    if (!container) {
      return res.status(503).send("Service not ready");
    }

    const querySpec = {
      query: "SELECT * FROM c ORDER BY c.createdAt DESC OFFSET 0 LIMIT 5"
    };

    const { resources } = await container.items.query(querySpec).fetchAll();
    res.json(resources);

  } catch (err) {
    console.error("GET /reviews error:", err);
    res.status(500).send(err.message);
  }
});

// Start only AFTER Cosmos DB is ready (IMPORTANT FIX)
const PORT = process.env.PORT || 3000;

init()
  .then((c) => {
    container = c;

    app.listen(PORT, () => {
      console.log("Server running on port", PORT);
      console.log("Cosmos DB connected successfully");
    });
  })
  .catch((err) => {
    console.error("Failed to initialize Cosmos DB:", err);
    process.exit(1);
  });
