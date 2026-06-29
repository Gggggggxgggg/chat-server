const WebSocket = require("ws");
const crypto = require("crypto");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

const users = new Map();

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

// ---------------- DATABASE ----------------

if (!fs.existsSync("./database")) {
    fs.mkdirSync("./database");
}

const db = new sqlite3.Database("./database/chat.db");

// USERS TABLE
db.run(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    password TEXT
)
`);

// MESSAGES TABLE
db.run(`
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT,
    name TEXT,
    type TEXT,
    text TEXT,
    fileType TEXT,
    fileName TEXT,
    data TEXT,
    time INTEGER
)
`);

// ---------------- HELPERS ----------------

function broadcastRoom(room, data) {
    const msg = JSON.stringify(data);

    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            const u = users.get(client);
            if (u && u.room === room) {
                client.send(msg);
            }
        }
    });
}

function sendOnline(room) {
    const list = [];

    users.forEach(u => {
        if (u.room === room && u.auth) {
            list.push({
                id: u.id,
                name: u.name,
                avatar: DEFAULT_AVATAR
            });
        }
    });

    broadcastRoom(room, {
        type: "online",
        users: list
    });
}

// SAVE MESSAGE
function saveMessage(room, name, data) {
    db.run(`
        INSERT INTO messages (room, name, type, text, fileType, fileName, data, time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        room,
        name,
        data.type,
        data.text || "",
        data.fileType || "",
        data.fileName || "",
        data.data || "",
        Date.now()
    ]);
}

// ---------------- SERVER ----------------

server.on("connection", (ws) => {

    const user = {
        id: crypto.randomUUID(),
        name: null,
        room: "global",
        auth: false
    };

    users.set(ws, user);

    ws.on("message", (raw) => {

        let msg;
        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        const u = users.get(ws);
        if (!u) return;

        // ---------------- REGISTER ----------------
        if (msg.type === "register") {

            const { username, password } = msg;

            db.get(
                "SELECT * FROM users WHERE name = ?",
                [username],
                (err, row) => {

                    if (row) {
                        ws.send(JSON.stringify({
                            type: "error",
                            text: "User already exists"
                        }));
                        return;
                    }

                    db.run(
                        "INSERT INTO users (name, password) VALUES (?, ?)",
                        [username, password]
                    );

                    u.name = username;
                    u.auth = true;

                    ws.send(JSON.stringify({
                        type: "login_ok",
                        name: username
                    }));

                    sendOnline(u.room);
                }
            );

            return;
        }

        // ---------------- LOGIN ----------------
        if (msg.type === "login") {

            const { username, password } = msg;

            db.get(
                "SELECT * FROM users WHERE name = ? AND password = ?",
                [username, password],
                (err, row) => {

                    if (!row) {
                        ws.send(JSON.stringify({
                            type: "error",
                            text: "Wrong login or password"
                        }));
                        return;
                    }

                    u.name = username;
                    u.auth = true;

                    ws.send(JSON.stringify({
                        type: "login_ok",
                        name: username
                    }));

                    sendOnline(u.room);
                }
            );

            return;
        }

        // ---------------- BLOCK IF NOT AUTH ----------------
        if (!u.auth) return;

        // ---------------- JOIN ROOM ----------------
        if (msg.type === "join") {
            u.room = msg.room;
            users.set(ws, u);

            sendOnline(u.room);
            return;
        }

        // ---------------- TEXT ----------------
        if (msg.type === "text") {

            const data = {
                type: "text",
                name: u.name,
                avatar: DEFAULT_AVATAR,
                text: msg.text
            };

            broadcastRoom(u.room, data);
            saveMessage(u.room, u.name, data);
        }

        // ---------------- FILE ----------------
        if (msg.type === "file") {

            const data = {
                type: "file",
                name: u.name,
                avatar: DEFAULT_AVATAR,
                fileType: msg.fileType,
                fileName: msg.fileName,
                data: msg.data
            };

            broadcastRoom(u.room, data);
            saveMessage(u.room, u.name, data);
        }

        // ---------------- TYPING ----------------
        if (msg.type === "typing") {
            broadcastRoom(u.room, {
                type: "typing",
                name: u.name
            });
        }

        // ---------------- CHANGE NAME ----------------
        if (msg.type === "name") {
            u.name = msg.name;
            users.set(ws, u);

            sendOnline(u.room);
        }
    });

    ws.on("close", () => {
        const u = users.get(ws);
        users.delete(ws);

        if (u) sendOnline(u.room);
    });
});

console.log("🚀 Server running on port " + PORT);
