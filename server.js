const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();

app.use(cors());

app.get("/", (req, res) => {
    res.send("chat server online");
});

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


let rooms = {};

io.on("connection", (socket) => {

    console.log("user connected");


    socket.on("joinRoom", ({room, name}) => {

        socket.join(room);

        socket.room = room;
        socket.name = name;


        if(!rooms[room])
            rooms[room] = 0;


        rooms[room]++;


        io.to(room).emit("system", {
            text: `${name} joined ${room}`
        });


        io.to(room).emit("roomInfo", {
            room,
            users: rooms[room]
        });

    });



    socket.on("message", (data)=>{

        io.to(data.room).emit("message", {
            name:data.name,
            text:data.text
        });

    });



    socket.on("disconnect", ()=>{

        if(socket.room){

            rooms[socket.room]--;

            io.to(socket.room).emit("roomInfo",{
                room:socket.room,
                users:rooms[socket.room]
            });

        }

        console.log("user disconnected");

    });

});


const PORT = process.env.PORT || 3000;

server.listen(PORT, ()=>{
    console.log("server started on port", PORT);
});
