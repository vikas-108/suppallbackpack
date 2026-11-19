import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import User from "../models/User.js";
import { env } from "../config/env.js";

const connectedClients = new Set();

function rejectUpgrade(socket, statusCode, statusText) {
  socket.write(`HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function sendEvent(client, event, data) {
  if (client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify({ event, data }));
  }
}

export function emitToShop(shopId, event, data = {}) {
  const target = String(shopId);
  for (const client of connectedClients) {
    if (client.shopId === target) sendEvent(client, event, data);
  }
}

export function emitToUser(userId, event, data = {}) {
  const target = String(userId);
  for (const client of connectedClients) {
    if (client.userId === target) sendEvent(client, event, data);
  }
}

export function emitToAll(event, data = {}) {
  for (const client of connectedClients) sendEvent(client, event, data);
}

export function disconnectUser(userId) {
  const target = String(userId);
  for (const client of connectedClients) {
    if (client.userId === target) client.close(4003, "Account access changed.");
  }
}

export function createRealtimeToken(user) {
  return jwt.sign(
    { sub: String(user._id), shopId: user.shopId ? String(user.shopId) : null, purpose: "realtime" },
    env.jwtSecret,
    { expiresIn: "5m", issuer: "buildsupply", audience: "buildsupply-realtime" }
  );
}

export function attachRealtimeServer(server) {
  const webSocketServer = new WebSocketServer({
    noServer: true,
    maxPayload: 1024,
    handleProtocols(protocols) {
      return protocols.has("buildsupply") ? "buildsupply" : false;
    }
  });

  async function handleUpgrade(request, socket, head) {
    let pathname;
    try {
      pathname = new URL(request.url, "http://localhost").pathname;
    } catch {
      rejectUpgrade(socket, 400, "Bad Request");
      return;
    }
    if (pathname !== "/realtime") {
      rejectUpgrade(socket, 404, "Not Found");
      return;
    }

    const origin = request.headers.origin;
    if (origin) {
      let requestOrigin;
      try {
        requestOrigin = new URL(origin).origin;
      } catch {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }
      if (requestOrigin !== new URL(env.appOrigin).origin) {
        rejectUpgrade(socket, 403, "Forbidden");
        return;
      }
    }

    const protocols = String(request.headers["sec-websocket-protocol"] || "")
      .split(",")
      .map(value => value.trim());
    const token = protocols.find(value => value && value !== "buildsupply");
    if (!protocols.includes("buildsupply") || !token) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    let claims;
    try {
      claims = jwt.verify(token, env.jwtSecret, {
        issuer: "buildsupply",
        audience: "buildsupply-realtime"
      });
      if (typeof claims !== "object" || claims.purpose !== "realtime" || !claims.sub) {
        rejectUpgrade(socket, 401, "Unauthorized");
        return;
      }
    } catch {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }

    let user;
    try {
      user = await User.findById(claims.sub);
    } catch (error) {
      console.error("Could not verify realtime account access.", {
        errorName: error.name,
        code: error.code || "REALTIME_AUTH_LOOKUP_FAILED"
      });
      rejectUpgrade(socket, 503, "Service Unavailable");
      return;
    }

    const shopUser = user && ["shop_owner", "delivery"].includes(user.role) &&
      user.shopId && String(user.shopId) === String(claims.shopId);
    const buyer = user && user.role === "buyer" && !user.shopId && claims.shopId === null;
    if (!user || !user.isActive || (!shopUser && !buyer)) {
      rejectUpgrade(socket, 403, "Forbidden");
      return;
    }
    if (socket.destroyed) return;

    webSocketServer.handleUpgrade(request, socket, head, client => {
      client.userId = String(user._id);
      client.shopId = user.shopId ? String(user.shopId) : null;
      client.isAlive = true;
      client.expiryTimer = setTimeout(
        () => client.close(4001, "Realtime token expired."),
        Math.max(0, claims.exp * 1000 - Date.now())
      );
      connectedClients.add(client);
      client.on("pong", () => { client.isAlive = true; });
      client.on("close", () => {
        clearTimeout(client.expiryTimer);
        connectedClients.delete(client);
      });
      client.on("error", error => {
        console.error("Realtime connection failed.", { errorName: error.name });
        connectedClients.delete(client);
      });
      webSocketServer.emit("connection", client, request);
    });
  }

  server.on("upgrade", handleUpgrade);
  const heartbeat = setInterval(() => {
    for (const client of connectedClients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (!client.isAlive) {
        client.terminate();
        connectedClients.delete(client);
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);

  return async function closeRealtimeServer() {
    clearInterval(heartbeat);
    server.off("upgrade", handleUpgrade);
    for (const client of connectedClients) client.terminate();
    connectedClients.clear();
    await new Promise(resolve => webSocketServer.close(resolve));
  };
}
