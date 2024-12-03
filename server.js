const express = require('express');
const WebSocket = require('ws');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3002;

app.use(express.json());

const events = [];

const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection established.');
});

app.post('/events', (req, res) => {
    const { title, description, time } = req.body;

    if (!title || !description || !time) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    const event = { title, description, time, notified: false, logged: false };
    events.push(event);

    res.json({ message: 'Event added successfully', event });
});

app.get('/events', (req, res) => {
    res.json(events);
});

function notifyUsers(event) {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(`Event starting soon: ${event.title}`);
        }
    });
}

cron.schedule('* * * * *', () => {
    const now = new Date();

    events.forEach((event) => {
        const eventTime = new Date(event.time);

        if (!event.notified && eventTime - now <= 5 * 60 * 1000 && eventTime - now > 0) {
            notifyUsers(event);
            event.notified = true;
        }

        if (eventTime <= now && !event.logged) {
            event.logged = true;

            const completedEvent = {
                title: event.title,
                description: event.description,
                time: event.time,
                completedAt: now.toISOString(),
            };

            const filePath = path.join(__dirname, 'events.json');
            fs.readFile(filePath, 'utf8', (err, data) => {
                let loggedEvents = [];
                if (!err && data) {
                    loggedEvents = JSON.parse(data);
                }
                loggedEvents.push(completedEvent);

                fs.writeFile(filePath, JSON.stringify(loggedEvents, null, 2), (err) => {
                    if (err) {
                        console.error('Error saving event:', err);
                    }
                });
            });
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
