const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

const db = new sqlite3.Database("./chat.db");

db.run(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
username TEXT UNIQUE,
password TEXT,
avatar TEXT DEFAULT '',
birthday TEXT DEFAULT ''
);
`);

let clients = new Map(); // ws -> user

function broadcastRoom(room, data, exceptWs = null) {
  wss.clients.forEach(c => {
    const u = clients.get(c);
    if (c.readyState === 1 && u?.room === room && c !== exceptWs) {
      c.send(JSON.stringify(data));
    }
  });
}

function sendOnline(room) {
  const list = [];

  clients.forEach(u => {
    if (u.room === room) {
      list.push({
        id: u.id,
        name: u.username,
        avatar: u.avatar
      });
    }
  });

  broadcastRoom(room, { type: "online", users: list });
}

wss.on("connection", (ws) => {

  ws.user = null;

  ws.on("message", (raw) => {
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    // REGISTER
    if (data.type === "register") {
      const hash = bcrypt.hashSync(data.password, 10);

      db.run(
        "INSERT INTO users(username,password,avatar) VALUES(?,?,?)",
        [data.username, hash, DEFAULT_AVATAR],
        (err) => {
          if (err) {
            ws.send(JSON.stringify({ type: "error", text: "User exists" }));
            return;
          }
          ws.send(JSON.stringify({ type: "login_ok" }));
        }
      );
    }

    // LOGIN
    if (data.type === "login") {
      db.get(
        "SELECT * FROM users WHERE username=?",
        [data.username],
        (err, user) => {

          if (!user) {
            ws.send(JSON.stringify({ type: "error", text: "No user" }));
            return;
          }

          if (!bcrypt.compareSync(data.password, user.password)) {
            ws.send(JSON.stringify({ type: "error", text: "Wrong password" }));
            return;
          }

          ws.user = {
            id: user.id,
            username: user.username,
            avatar: user.avatar || DEFAULT_AVATAR,
            room: "global"
          };

          clients.set(ws, ws.user);

          ws.send(JSON.stringify({
            type: "login_ok",
            user: ws.user
          }));

          sendOnline("global");
        }
      );
    }

    // JOIN
    if (data.type === "join") {
      const u = clients.get(ws);
      if (!u) return;

      u.room = data.room;
      clients.set(ws, u);

      sendOnline(data.room);
    }

    // TEXT
    if (data.type === "text") {
      const u = clients.get(ws);
      if (!u) return;

      broadcastRoom(u.room, {
        type: "text",
        name: u.username,
        avatar: u.avatar,
        text: data.text
      });
    }

    // FILE
    if (data.type === "file") {
      const u = clients.get(ws);
      if (!u) return;

      broadcastRoom(u.room, {
        type: "file",
        name: u.username,
        avatar: u.avatar,
        fileName: data.fileName,
        fileType: data.fileType,
        data: data.data
      });
    }

    // TYPING
    if (data.type === "typing") {
      const u = clients.get(ws);
      if (!u) return;

      broadcastRoom(u.room, {
        type: "typing",
        name: u.username
      }, ws);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
  });
});

server.listen(8080, () => {
  console.log("Server running on 8080");
});
