const socketIo = require('socket.io');

let io;

module.exports = {
    init: (httpServer) => {
        io = socketIo(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || "*",
                methods: ["GET", "POST", "PUT", "DELETE"]
            }
        });

        io.on('connection', (socket) => {
            console.log('New client connected via WebSocket:', socket.id);

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
            });
        });

        return io;
    },
    getIO: () => {
        if (!io) {
            // Return a dummy object for testing environments where Socket.io isn't fully booted
            return {
                emit: (...args) => {
                    if (process.env.NODE_ENV !== 'test') {
                        console.warn('[SocketService] getIO() called before init, ignoring emit:', args[0]);
                    }
                },
                on: () => {}
            };
        }
        return io;
    }
};
