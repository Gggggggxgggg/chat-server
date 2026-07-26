const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");


const app = express();

app.use(cors());


app.get("/", (req,res)=>{
    res.send("Realtime chat server is online");
});


const server = http.createServer(app);


const io = new Server(server,{

    cors:{
        origin:"*",
        methods:["GET","POST"]
    }

});


let rooms = {};



io.on("connection",(socket)=>{


    console.log("connected:",socket.id);



    socket.on("joinRoom",(data)=>{


        let room=data.room || "general";
        let name=data.name || "Guest";


        socket.room=room;
        socket.name=name;


        socket.join(room);



        if(!rooms[room]){
            rooms[room]=[];
        }


        rooms[room].push(socket.id);



        io.to(room).emit("system",{
            text:`${name} joined the room`
        });



        io.to(room).emit("roomInfo",{

            room:room,

            users:rooms[room].length

        });



    });





    socket.on("message",(data)=>{


        io.to(data.room).emit("message",{

            name:data.name,

            text:data.text,

            avatar:"https://i.imgur.com/8pyk61L.png"

        });


    });






    socket.on("typing",(data)=>{


        socket.to(data.room).emit("typing",{

            name:data.name

        });


    });








    socket.on("disconnect",()=>{


        let room=socket.room;


        if(room && rooms[room]){


            rooms[room]=rooms[room].filter(

                id=>id!==socket.id

            );


            io.to(room).emit("roomInfo",{

                room:room,

                users:rooms[room].length

            });


        }



        console.log("disconnected:",socket.id);


    });



});





const PORT=process.env.PORT || 3000;


server.listen(PORT,()=>{

    console.log(
        "server running on port",
        PORT
    );

});
