var SocketIOFileUpload = require("socketio-file-upload")
const fs = require('fs')
const port = process.env.PORT || 8000;
const express = require('express')
const app = express()
app.use(SocketIOFileUpload.router);

var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));



const http = require('http')
const { Server } = require('socket.io');
const { join } = require("path");
const server = http.createServer(app)
const io = new Server(server)
const cors = require('cors')
app.use(cors())
app.use(express.static(__dirname));
app.use(express.static(__dirname + '/uploads'));
app.use(express.json())
app.set('view engine', 'ejs')


app.get('/', (req, res) => {

  res.render('index')
})

app.get('/game', (req, res) => {

  res.render('game');
})

app.post('/game', (req, res) => {

  var username = req.body.username;

  res.render('game', { user: username });
})

var unmatched;

players = {}, unmatched;


io.on("connection", function (socket) {

  joinServer(socket);

  console.log("New socket connected: " + socket.id)


  socket.on('send-video', path => {
    console.log(__dirname + path.src)
    socket.to(path.opponent).emit('display-video', path)
  })

  var uploader = new SocketIOFileUpload();
  uploader.dir = "uploads";
  uploader.listen(socket);

  // Do something when a file is saved:
  uploader.on("saved", function (event) {
    event.file.clientDetail.name = event.file.name;
  });

  // Error handler:
  uploader.on("error", function (event) {
    console.log("Error from uploader", event);
  });

socket.on('score-point', (data) => {
  io.to(data.opponent).emit('score-point-response', data)
})

socket.on('upload-pass-turn', (data) => {
  io.to(data.opponent).emit('upload-pass-turn-response', data)
})

socket.on('nok-pass-turn', (data) => {
  io.to(data.opponent).emit('nok-pass-turn-response', data)
})

socket.on('timer-controller', (data) => {
  io.to(data.opponent).emit('timer-controller-response', data)
})

socket.on('initialize-clock', (data) => {
  io.to(data.opponent).emit('initialize-clock-response', data)
})

socket.on('name-info', (data) => {
  io.to(data.opponent).emit('name-info-response', {'name': data.name})
})

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

socket.on('name2-info', async (data) => {
  await delay(1000)
 io.to(data.sender).emit('name2-info-response', {'name': data.name2})
  // io.to(data.sender).emit('name-info-response', {'name': data.name})
})

socket.on('send-score', (data) => {
  io.to(data.opponent).emit('send-score-response', {'score': data.score})
  if (data.score >= 5) {
   io.to(data.opponent).emit('game-over', {'winner': data.player_name})
   io.to(data.socket).emit('game-over', {'winner': data.player_name})
  }
})

socket.on('disconnect', () => {
  console.log('PLAYER LEFT, opponent: ', players[socket.id].opponent)
  io.to(players[socket.id].opponent).emit('player-left', {'socket': socket.id})

  if (!unmatched) {
    unmatched = socket.id;
  } else {
    unmatched = null
  }
  

})

});

function joinServer(socket) {
  // Add the player to our object of players
  players[socket.id] = {
    // The opponent will either be the socket that is
    // currently unmatched, or it will be null if no
    // players are unmatched
    opponent: unmatched,
    // The symbol will become 'O' if the player is unmatched
    isTaskGiver: true,
    isPlayerTurn: true,
    canUpload: true,
    score: 0,
    // The socket that is associated with this player
    socket: socket
  };
  // Every other player is marked as 'unmatched', which means
  // there is not another player to pair them with yet. As soon
  // as the next socket joins, the unmatched player is paired with
  // the new socket and the unmatched variable is set back to null

  if (unmatched) {
    players[socket.id].isTaskGiver = false;
    players[socket.id].isPlayerTurn = false;
    players[socket.id].canUpload = false;
    players[socket.id].score = 0;
    players[unmatched].opponent = socket.id;


    io.to(unmatched).emit('opponent-info', {
      'opponent': socket.id
    })
    
    unmatched = null;
  } else {
    
    unmatched = socket.id;
  }
 
  var player_info = {
    'socket': socket.id,
    'opponent': players[socket.id].opponent,
    'task_giver': players[socket.id].isTaskGiver,
    'player_turn': players[socket.id].isPlayerTurn,
    'can_upload': players[socket.id].canUpload,
    'score': players[socket.id].score
  }

  console.log("Player info: \n" + JSON.stringify(player_info))

  socket.emit('player-info', player_info)
}

function getOpponent(socket) {
  if (!players[socket.id].opponent) {
    return;
  }
  return players[players[socket.id].opponent].socket;
}


server.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
