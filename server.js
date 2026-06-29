const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

const users = new Map(); // ws -> user

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
        if (u.room === room) list.push({
            id: u.id,
            name: u.name,
            avatar: u.avatar
        });
    });

    broadcastRoom(room, {
        type: "online",
        users: list
    });
}

server.on("connection", (ws) => {
    const id = crypto.randomUUID();

    const user = {
        id,
        name: "Guest_" + id.slice(0, 5),
        room: "global",
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=" + id
    };

    users.set(ws, user);

    ws.send(JSON.stringify({
        type: "system",
        text: "connected",
        user
    }));

    sendOnline(user.room);

    ws.on("message", (raw) => {
        let msg;

        try {
            msg = JSON.parse(raw.toString());
        } catch {
            return;
        }

        const user = users.get(ws);
        if (!user) return;

        // ================= ROOM =================
        if (msg.type === "join") {
            user.room = msg.room;
            users.set(ws, user);

            sendOnline(user.room);

            broadcastRoom(user.room, {
                type: "system",
                text: user.name + " joined " + user.room
            });
        }

        // ================= TEXT =================
        if (msg.type === "text") {
            broadcastRoom(user.room, {
                type: "text",
                name: user.name,
                avatar: user.avatar,
                text: msg.text,
                time: Date.now()
            });
        }

        // ================= FILE =================
        if (msg.type === "file") {
            broadcastRoom(user.room, {
                type: "file",
                name: user.name,
                avatar: user.avatar,
                fileType: msg.fileType,
                fileName: msg.fileName,
                data: msg.data
            });
        }

        // ================= TYPING =================
        if (msg.type === "typing") {
            broadcastRoom(user.room, {
                type: "typing",
                name: user.name
            });
        }

        // ================= NAME =================
        if (msg.type === "name") {
            user.name = msg.name;
            users.set(ws, user);

            sendOnline(user.room);
        }
    });

    ws.on("close", () => {
        const user = users.get(ws);
        users.delete(ws);

        if (user) {
            sendOnline(user.room);
        }
    });
});

console.log("🚀 Server running on " + PORT);
