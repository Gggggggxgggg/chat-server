const WebSocket = require("ws");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();

const PORT = process.env.PORT || 8080;
const server = new WebSocket.Server({ port: PORT });

const db = new sqlite3.Database("./database.db");

db.serialize(() => {
db.run(`
CREATE TABLE IF NOT EXISTS users (
id TEXT PRIMARY KEY,
name TEXT,
password TEXT,
avatar TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS messages (
id INTEGER PRIMARY KEY AUTOINCREMENT,
room TEXT,
fromUser TEXT,
text TEXT,
type TEXT,
time INTEGER
)
`);
});

const clients = new Map();

const DEFAULT_AVATAR = "https://i.imgur.com/8pyk61L.png";

function randomColor(){
    return "#" + Math.floor(Math.random()*16777215).toString(16);
}

/* SEND ROOM */
function sendToRoom(room, data){
    server.clients.forEach(c=>{
        const u = clients.get(c);
        if(c.readyState === WebSocket.OPEN && u?.room === room){
            c.send(JSON.stringify(data));
        }
    });
}

/* ONLINE */
function sendOnline(room){
    const list = [];

    clients.forEach(u=>{
        if(u.room === room){
            list.push({
                id:u.id,
                name:u.name,
                avatar:u.avatar,
                color:u.color
            });
        }
    });

    sendToRoom(room,{
        type:"online",
        users:list
    });
}

server.on("connection",(ws)=>{

    const id = crypto.randomUUID();

    const user = {
        id,
        name:"Guest_"+id.slice(0,5),
        room:"global",
        avatar:DEFAULT_AVATAR,
        color: randomColor()
    };

    clients.set(ws,user);

    sendOnline("global");

    ws.on("message",(raw)=>{
        let msg;
        try{ msg = JSON.parse(raw.toString()); }catch{return;}

        const u = clients.get(ws);
        if(!u) return;

        /* JOIN */
        if(msg.type==="join"){

            u.room = msg.room || "global";

            if(msg.name && msg.name.trim()){
                u.name = msg.name.trim();
            }

            clients.set(ws,u);

            sendOnline(u.room);
        }

        /* TEXT */
        if(msg.type==="text"){
            const data = {
                type:"text",
                name:u.name,
                avatar:u.avatar,
                color:u.color,
                text:msg.text,
                room:u.room
            };

            db.run(
                "INSERT INTO messages(room,fromUser,text,type,time) VALUES (?,?,?,?,?)",
                [u.room,u.name,msg.text,"text",Date.now()]
            );

            sendToRoom(u.room,data);
        }

        /* FILE */
        if(msg.type==="file"){
            sendToRoom(u.room,{
                type:"file",
                name:u.name,
                avatar:u.avatar,
                color:u.color,
                fileName:msg.fileName,
                fileType:msg.fileType,
                data:msg.data
            });
        }

        /* TYPING */
        if(msg.type==="typing"){
            sendToRoom(u.room,{
                type:"typing",
                name:u.name
            });
        }
    });

    ws.on("close",()=>{
        clients.delete(ws);
    });
});

console.log("Server running on " + PORT);
