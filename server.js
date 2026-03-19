const express = require("express");
const axios = require("axios");
const WebSocket = require("ws");
const cors = require("cors");
const clustering = require("density-clustering");

const app = express();
app.use(cors());

const server = app.listen(3000, () => {
  console.log("God’s Eye V7 running");
});

const wss = new WebSocket.Server({ server });
let clients = [];

let timeline = [];
let historyMemory = {};

wss.on("connection", ws => {
  clients.push(ws);
  ws.on("close", () => clients = clients.filter(c => c !== ws));
});

function broadcast(data) {
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

async function fetchFlights() {
  try {
    const res = await axios.get("https://opensky-network.org/api/states/all");
    return res.data.states.map(f => ({
      lat: f[6],
      lon: f[5]
    })).filter(f => f.lat && f.lon);
  } catch {
    return [];
  }
}

function detectClusters(flights) {
  const dataset = flights.map(f => [f.lat, f.lon]);

  const dbscan = new clustering.DBSCAN();
  const clusters = dbscan.run(dataset, 1.2, 8);

  return clusters.map(cluster => {
    const pts = cluster.map(i => dataset[i]);

    const lat = pts.reduce((a,p)=>a+p[0],0)/pts.length;
    const lon = pts.reduce((a,p)=>a+p[1],0)/pts.length;

    return { lat, lon, size: pts.length };
  });
}

function scoreClusters(clusters) {
  return clusters.map(c => {
    const key = `${Math.round(c.lat)}_${Math.round(c.lon)}`;

    if (!historyMemory[key]) historyMemory[key] = 0;
    historyMemory[key] += 1;

    const score = (c.size * 0.5) + (historyMemory[key] * 5);

    return {
      ...c,
      score
    };
  });
}

async function updateLoop() {
  const flights = await fetchFlights();
  const clusters = detectClusters(flights);
  const scored = scoreClusters(clusters);

  const snapshot = {
    time: Date.now(),
    flights,
    clusters: scored
  };

  timeline.push(snapshot);
  if (timeline.length > 100) timeline.shift();

  broadcast({
    ...snapshot,
    timeline
  });
}

setInterval(updateLoop, 4000);
