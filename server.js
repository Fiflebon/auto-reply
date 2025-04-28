const express = require('express');
const bodyParser = require('body-parser');
const { startBot, stopBot, setPrivateMessage, setDoneReplyMessage, setCommentaireMessage } = require('./index');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

let isBotRunning = false;

// Lancer le bot
app.post('/start', async (req, res) => {
    if (!isBotRunning) {
        await startBot();
        isBotRunning = true;
        res.send('🤖 Bot démarré');
        console.log('Bot démarré');
    } else {
        res.send('🔄 Bot déjà en cours');
        console.log('Bot déjà en cours');
    }
});

// Arrêter le bot
app.post('/stop', async (req, res) => {
    if (isBotRunning) {
        await stopBot();
        isBotRunning = false;
        res.send('🛑 Bot arrêté');
        console.log('Bot arrêté');
    } else {
        res.send('⛔ Bot déjà à l’arrêt');
        console.log('Bot déjà à l’arrêt');
    }
});

// Modifier le message privé standard
app.post('/set-private-message', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).send('❌ Message requis');
    setPrivateMessage(message);
    res.send('✅ Message privé standard mis à jour');
});

// Modifier le message pour les "done"
app.post('/set-done-message', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).send('❌ Message requis');
    setDoneReplyMessage(message);
    res.send('✅ Message "done" mis à jour');
});


// Modifier premier message en commentaire
app.post('/set-first-commentaire', (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).send('❌ Message requis');
    setCommentaireMessage(message);
    res.send('✅ Message commentaire mis à jour');
});


app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
});
