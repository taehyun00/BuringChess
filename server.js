const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev });
const handle = app.getRequestHandler();

const games = new Map();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    path: '/socket.io'
  });

  io.on('connection', (socket) => {
    console.log('✅ User connected:', socket.id);

    socket.on('createGame', () => {
      const gameId = Math.random().toString(36).substring(7);
      games.set(gameId, {
        players: [socket.id],
        board: null,
        currentPlayer: 'white',
        whitePlayer: socket.id,
        blackPlayer: null
      });
      socket.join(gameId);
      socket.emit('gameCreated', { gameId, color: 'white' });
      console.log('🎮 Game created:', gameId, 'by', socket.id);
    });

    socket.on('joinGame', (gameId) => {
      console.log('🔍 Join attempt for game:', gameId, 'by', socket.id);
      const game = games.get(gameId);
      if (game && game.players.length === 1) {
        game.players.push(socket.id);
        game.blackPlayer = socket.id;
        socket.join(gameId);
        io.to(gameId).emit('gameStart', {
          whitePlayer: game.whitePlayer,
          blackPlayer: game.blackPlayer
        });
        socket.emit('gameJoined', { gameId, color: 'black' });
        console.log('👥 Player joined game:', gameId);
      } else {
        console.log('❌ Game not found or full:', gameId);
        socket.emit('error', 'Game not found or full');
      }
    });

    socket.on('move', ({ gameId, board, currentPlayer }) => {
      const game = games.get(gameId);
      if (game) {
        game.board = board;
        game.currentPlayer = currentPlayer;
        socket.to(gameId).emit('opponentMove', { board, currentPlayer });
        console.log('♟️ Move made in game:', gameId);
      }
    });

    socket.on('gameOver', ({ gameId, winner }) => {
      io.to(gameId).emit('gameOver', { winner });
      console.log('🏆 Game over:', gameId, 'Winner:', winner);
    });

    socket.on('disconnect', () => {
      console.log('❌ User disconnected:', socket.id);
      games.forEach((game, gameId) => {
        if (game.players.includes(socket.id)) {
          io.to(gameId).emit('playerDisconnected');
          games.delete(gameId);
          console.log('🗑️ Game deleted:', gameId);
        }
      });
    });
  });

  httpServer
    .once('error', (err) => {
      console.error('❌ Server error:', err);
      process.exit(1);
    })
    .listen(port, hostname, () => {
      console.log(`🚀 Ready on http://${hostname}:${port}`);
      console.log('🔌 Socket.IO server is running');
      console.log('🌍 Environment:', process.env.NODE_ENV || 'development');
    });
});
