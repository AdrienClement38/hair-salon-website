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
            throw new Error('Socket.io not initialized!');
        }
        return io;
    }
};
