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

let clients = new Map();

/* ---------------- ROOM BROADCAST ---------------- */

function broadcastRoom(room, data, except = null) {
wss.clients.forEach(c => {
if (c.readyState === 1 && c.room === room && c !== except) {
c.send(JSON.stringify(data));
}
});
}

/* ---------------- ONLINE ---------------- */

function sendOnline(room) {
let users = [];

wss.clients.forEach(c => {
if (c.room === room && c.user) {
users.push({
id: c.user.id,
name: c.user.username,
avatar: c.user.avatar || DEFAULT_AVATAR
});
}
});

broadcastRoom(room, {
type: "online",
users
});
}

/* ---------------- CONNECTION ---------------- */

wss.on("connection", (ws) => {

ws.room = "global";
ws.user = null;

/* ---------------- MESSAGE ---------------- */

ws.on("message", (raw) => {
let data;
try { data = JSON.parse(raw); } catch { return; }

/* ---------------- REGISTER ---------------- */

if (data.type === "register") {
let hash = bcrypt.hashSync(data.password, 10);

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

/* ---------------- LOGIN ---------------- */

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
...user,
avatar: user.avatar || DEFAULT_AVATAR
};

ws.send(JSON.stringify({
type: "login_ok",
user: ws.user
}));
}
);
}

/* ---------------- JOIN ---------------- */

if (data.type === "join") {
ws.room = data.room || "global";
sendOnline(ws.room);
}

/* ---------------- PROFILE UPDATE ---------------- */

if (data.type === "update_profile") {
if (!ws.user) return;

const avatar = data.avatar || DEFAULT_AVATAR;

db.run(
"UPDATE users SET avatar=?, birthday=? WHERE id=?",
[avatar, data.birthday || "", ws.user.id]
);

ws.user.avatar = avatar;
ws.user.birthday = data.birthday;
}

/* ---------------- TEXT ---------------- */

if (data.type === "text") {
if (!ws.user) return;

broadcastRoom(ws.room, {
type: "text",
name: ws.user.username,
text: data.text,
avatar: ws.user.avatar || DEFAULT_AVATAR
});
}

/* ---------------- FILE ---------------- */

if (data.type === "file") {
if (!ws.user) return;

broadcastRoom(ws.room, {
type: "file",
name: ws.user.username,
fileName: data.fileName,
data: data.data,
avatar: ws.user.avatar || DEFAULT_AVATAR
});
}

/* ---------------- TYPING ---------------- */

if (data.type === "typing") {
if (!ws.user) return;

broadcastRoom(ws.room, {
type: "typing",
name: ws.user.username
}, ws);
}

});

/* ---------------- DISCONNECT ---------------- */

ws.on("close", () => {
if (ws.room) sendOnline(ws.room);
});

});

server.listen(8080, () => {
console.log("Server running on 8080");
});
