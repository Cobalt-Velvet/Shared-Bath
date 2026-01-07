const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
app.use(express.static('src/public'));
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for development convenience
        methods: ["GET", "POST"]
    }
});

// 1. Global State
// Single source of truth managed in server memory.
let globalState = {
    waterLevel: 0,
    temperature: 0
};

// Connected Users (For IP identification)
let connectedUsers = new Set();

// 2. Utility: IP Masking (XXX.XXX.*.*)
function maskIP(ip) {
    if (!ip) return 'UNKNOWN';
    const cleanIp = ip.replace('::ffff:', '');
    const parts = cleanIp.split('.');

    if (parts.length === 4) {
        // 111.222.333.444 -> 111.***.333.***
        return `${parts[0]}.***.${parts[2]}.***`;
    }

    return 'Anonymous';
}

// 3. Socket Connection Handling
io.on('connection', (socket) => {
    // Mask the IP of the connected client
    const rawIp = (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address).split(',')[0].trim();

    const maskedIp = maskIP(rawIp);

    console.log(`[Connect] User: ${maskedIp} (ID: ${socket.id})`);
    connectedUsers.add(maskedIp);

    // 3.1. [Server -> Client] Send initial state (init)
    socket.emit('init', {
        state: globalState,
        userIp: maskedIp,
        userList: Array.from(connectedUsers)
    });

    // Notify all clients about the updated user list
    io.emit('updateUserList', Array.from(connectedUsers));

    // 3.2. [Client -> Server] Receive action request (action)
    socket.on('action', (payload) => {
        let changed = false;

        switch (payload) {
            case 'FILL':
                // Clamping processing: Min(0) / Max(100)
                if (globalState.waterLevel < 100) {
                    globalState.waterLevel = Math.min(100, globalState.waterLevel + 2);
                    changed = true;
                }
                break;
            case 'DRAIN':
                if (globalState.waterLevel > 0) {
                    globalState.waterLevel = Math.max(0, globalState.waterLevel - 2);
                    changed = true;
                }
                break;
            case 'HEAT':
                if (globalState.temperature < 100) {
                    globalState.temperature = Math.min(100, globalState.temperature + 2);
                    changed = true;
                }
                break;
            case 'COOL':
                if (globalState.temperature > 0) {
                    globalState.temperature = Math.max(0, globalState.temperature - 2);
                    changed = true;
                }
                break;
        }

        if (changed) {
            // 3.3. [Server -> Client] Broadcast updated state (update)
            io.emit('update', globalState);
            console.log(`[Action] ${payload} -> Level: ${globalState.waterLevel}, Temp: ${globalState.temperature}`);
        }
    });

    // Handle Disconnection
    socket.on('disconnect', () => {
        console.log(`[Disconnect] User: ${maskedIp}`);
        connectedUsers.delete(maskedIp);
        io.emit('updateUserList', Array.from(connectedUsers));
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
    🛁 Shared Bath Server Started 🛁
    -------------------------------
    Port: ${PORT}
    Mode: Local Dev
    `);
});