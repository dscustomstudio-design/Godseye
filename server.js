const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");
const cors = require("cors");
const clustering = require("density-clustering");
const path = require("path");

const app = express();
app.use(cors());

// Serve static files from the root directory (this will serve index.html at /)
app.use(express.static(path.join(__dirname, ".")));

// Health check endpoint (instead of blocking the root)
app.get("/health", (req, res) => {
  res.send("God’s Eye backend is running.\n----------------------------------------------------------------------------------------------------");
});

// Use Render/Vercel dynamic port
const PORT = process.env.PORT || 3000;

// Start the HTTP server
const server = app.listen(PORT, () => {
  console.log(`God’s Eye V7 running on port ${PORT}`);
});

// Attach WebSocket server to the same HTTP server
const wss = new WebSocket.Server({ server });

let clients = [];

wss.on("connection", (ws) => {
  clients.push(ws);
  ws.on("close", () => {
    clients = clients.filter((c) => c !== ws);
  });
});

function broadcast(data) {
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// Fetch flight data from OpenSky Network
async function fetchFlights() {
  try {
    const res = await axios.get("https://opensky-network.org/api/states/all");
    return res.data.states
      .map((f) => ({
        lat: f[6],
        lon: f[5],
      }))
      .filter((f) => f.lat && f.lon);
  } catch {
    return [];
  }
}

// Detect clusters using DBSCAN
function detectClusters(flights) {
  const dataset = flights.map((f) => [f.lat, f.lon]);

  const dbscan = new clustering.DBSCAN();
  const clusters = dbscan.run(dataset, 1.2, 8);

  return clusters.map((cluster) => {
    const pts = cluster.map((i) => dataset[i]);

    const lat = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const lon = pts.reduce((a, p) => a + p[1], 0) / pts.length;

    return { lat, lon, size: pts.length };
  });
}

// Score clusters based on size and historical persistence
let historyMemory = {};

function scoreClusters(clusters) {
  return clusters.map((c) => {
    const key = `${Math.round(c.lat)}_${Math.round(c.lon)}`;

    if (!historyMemory[key]) historyMemory[key] = 0;
    historyMemory[key]++;

    const score = c.size * 0.5 + historyMemory[key] * 5;

    return { ...c, score };
  });
}

// Main update loop: fetch → cluster → score → broadcast
async function updateLoop() {
  const flights = await fetchFlights();
  const clusters = detectClusters(flights);
  const scored = scoreClusters(clusters);

  const snapshot = {
    time: Date.now(),
    clusters: scored,
  };

  broadcast(snapshot);
}

// Run every 4 seconds
setInterval(updateLoop, 4000);
