const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = 8080;

// ================= DB =================
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

db.run(`
CREATE TABLE IF NOT EXISTS messages (
id INTEGER PRIMARY KEY AUTOINCREMENT,
room TEXT,
sender TEXT,
text TEXT,
type TEXT,
data TEXT,
time DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ================= STATE =================
const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

let clients = new Map(); 
// ws -> {id, username, avatar, birthday, room}

// ================= HELPERS =================
function broadcastRoom(room, data, exceptWs = null) {
    wss.clients.forEach(client => {
        const u = clients.get(client);
        if (!u) return;

        if (client.readyState === WebSocket.OPEN && u.room === room) {
            if (client !== exceptWs) {
                client.send(JSON.stringify(data));
            }
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
                avatar: u.avatar || DEFAULT_AVATAR,
                birthday: u.birthday || ""
            });
        }
    });

    broadcastRoom(room, {
        type: "online",
        users: list
    });
}

// ================= WS =================
wss.on("connection", (ws) => {

    ws.room = "global";

    ws.on("message", (raw) => {
        let data;
        try { data = JSON.parse(raw.toString()); } catch { return; }

        const user = clients.get(ws);

        // ================= REGISTER =================
        if (data.type === "register") {
            const hash = bcrypt.hashSync(data.password, 10);

            db.run(
                "INSERT INTO users(username,password) VALUES(?,?)",
                [data.username, hash],
                (err) => {
                    if (err) {
                        ws.send(JSON.stringify({
                            type: "error",
                            text: "User already exists"
                        }));
                        return;
                    }

                    ws.send(JSON.stringify({ type: "login_ok" }));
                }
            );
        }

        // ================= LOGIN =================
        if (data.type === "login") {
            db.get(
                "SELECT * FROM users WHERE username=?",
                [data.username],
                (err, row) => {

                    if (!row) {
                        ws.send(JSON.stringify({ type: "error", text: "User not found" }));
                        return;
                    }

                    if (!bcrypt.compareSync(data.password, row.password)) {
                        ws.send(JSON.stringify({ type: "error", text: "Wrong password" }));
                        return;
                    }

                    const u = {
                        id: row.id,
                        username: row.username,
                        avatar: row.avatar || DEFAULT_AVATAR,
                        birthday: row.birthday || "",
                        room: "global"
                    };

                    clients.set(ws, u);

                    ws.send(JSON.stringify({
                        type: "login_ok",
                        user: u
                    }));

                    sendOnline(u.room);
                }
            );
        }

        // ================= JOIN ROOM =================
        if (data.type === "join") {
            const u = clients.get(ws);
            if (!u) return;

            u.room = data.room;
            ws.room = data.room;

            clients.set(ws, u);

            sendOnline(data.room);
        }

        // ================= UPDATE PROFILE =================
        if (data.type === "update_profile") {
            const u = clients.get(ws);
            if (!u) return;

            u.avatar = data.avatar || u.avatar;
            u.birthday = data.birthday || u.birthday;

            clients.set(ws, u);

            db.run(
                "UPDATE users SET avatar=?, birthday=? WHERE id=?",
                [u.avatar, u.birthday, u.id]
            );

            sendOnline(u.room);
        }

        // ================= TEXT =================
        if (data.type === "text") {
            const u = clients.get(ws);
            if (!u) return;

            const msg = {
                type: "text",
                name: u.username,
                text: data.text,
                avatar: u.avatar
            };

            db.run(
                "INSERT INTO messages(room,sender,text,type,data) VALUES(?,?,?,?,?)",
                [u.room, u.username, data.text, "text", ""]
            );

            broadcastRoom(u.room, msg);
        }

        // ================= FILE =================
        if (data.type === "file") {
            const u = clients.get(ws);
            if (!u) return;

            const msg = {
                type: "file",
                name: u.username,
                avatar: u.avatar,
                fileName: data.fileName,
                fileType: data.fileType,
                data: data.data
            };

            broadcastRoom(u.room, msg);
        }

        // ================= TYPING =================
        if (data.type === "typing") {
            const u = clients.get(ws);
            if (!u) return;

            broadcastRoom(u.room, {
                type: "typing",
                name: u.username
            }, ws);
        }
    });

    // ================= DISCONNECT =================
    ws.on("close", () => {
        clients.delete(ws);
    });
});

server.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
