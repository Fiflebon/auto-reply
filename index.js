const snoowrap = require('snoowrap');
require('dotenv').config()

const r = new snoowrap({
    userAgent: process.env.USER_AGENT || 'default-user-agent',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
});

const failedCommentIds = new Set();
const failedPMUsers = new Set();


const PUBLIC_REPLY = 'Verifie dans tes messages privés';

let privateMessage = `Salut ! Je suis un bot et je voulais juste te dire que j'ai trouvé ton commentaire intéressant ! Si tu veux discuter, n'hésite pas à me répondre ici ou sur mon profil.`;
let doneReplyPM = `Super ! Merci d'avoir confirmé. Si tu as d'autres questions, n'hésite pas à me répondre.`;

// Fonctions pour mettre à jour les messages
function setPrivateMessage(newMessage) {
    privateMessage = newMessage;
    console.log('✅ Nouveau message privé standard défini.');
}

function setDoneReplyMessage(newMessage) {
    doneReplyPM = newMessage;
    console.log('✅ Nouveau message privé de réponse au "done" défini.');
}

// Cooldown global en cas de ratelimit
let cooldownUntil = null;

async function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function hasAlreadyReplied(comment, myUsername) {
    try {
        const replies = await comment.expandReplies({ depth: 1 });
        return replies.replies.some(reply =>
            reply.author && reply.author.name.toLowerCase() === myUsername.toLowerCase()
        );
    } catch (err) {
        console.error(`Erreur dans hasAlreadyReplied: ${err}`);
        return false;
    }
}

async function replyComment(comment, text) {
    try {
        await comment.reply(text);
        console.log(`Réponse publique envoyée à ${comment.author.name}`);
        await delay(12000);
        return true;
    } catch (err) {
        if (err.message.includes('ratelimit')) {
            console.error('⏸️ Ratelimit détecté. Pause de 5 minutes.');
            cooldownUntil = Date.now() + 5 * 60 * 1000;
        } else {
            console.error(`Erreur lors de la réponse publique (${comment.id}): ${err}`);
            failedCommentIds.add(comment.id); // 🔸 Marquer ce commentaire comme échoué
        }
        return false;
    }
}

async function sendPrivateMessage(user, subject, text) {
    if (failedPMUsers.has(user)) {
        console.log(`⛔ MP ignoré pour ${user} (échec précédent)`);
        return;
    }

    try {
        await r.composeMessage({
            to: user,
            subject,
            text
        });
        console.log(`📩 MP envoyé à ${user}`);
        await delay(65000);
    } catch (err) {
        if (err.message.includes('ratelimit')) {
            console.error('⏸️ Ratelimit détecté (MP). Pause de 5 minutes.');
            cooldownUntil = Date.now() + 5 * 60 * 1000;
        } else {
            console.error(`❌ Erreur MP vers ${user} : ${err}`);
            failedPMUsers.add(user); // 🔴 Ne plus réessayer cet utilisateur
        }
    }
}


async function processPostComments() {
    const myUsername = (await r.getMe()).name;
    console.log(`🔍 Recherche de nouveaux commentaires sur les posts de ${myUsername}...`);
    const myPosts = await r.getMe().getSubmissions({ limit: 100 });

    for (const post of myPosts) {
        const comments = await post.expandReplies({ depth: 1, limit: 100 });

        for (const comment of comments.comments) {
            if (!comment) continue;

            // 🔴 Ne traite pas les commentaires en échec
            if (failedCommentIds.has(comment.id)) continue;

            // 🔸 Ne traite que les commentaires postés après le lancement du bot
            const commentDate = new Date(comment.created_utc * 1000);
            if (commentDate < dateActu) continue;

            const alreadyReplied = await hasAlreadyReplied(comment, myUsername);
            if (alreadyReplied) continue;

            console.log(`📬 Nouveau commentaire trouvé : ${comment.body}`);
            await replyComment(comment, PUBLIC_REPLY);
            await sendPrivateMessage(comment.author.name, 'Un petit message pour toi', privateMessage);
        }
    }
}

async function processInboxMessages() {
    const messages = await r.getInbox({ filter: 'messages', limit: 50 });

    for (const msg of messages) {
        // 🔸 Filtre : uniquement les messages non lus
        if (!msg.new) continue;

        // 🔸 Ignore les messages envoyés avant le lancement du bot
        const messageDate = new Date(msg.created_utc * 1000);
        if (messageDate < dateActu) continue;

        if (
            msg.body &&
            msg.body.toLowerCase().includes('done') &&
            !msg.was_comment &&
            !msg.replies // Pas déjà répondu
        ) {
            console.log(`📥 Message "done" non lu reçu de ${msg.author.name}`);

            try {
                await msg.reply(doneReplyPM); // ✅ Répond directement au message
                console.log(`📨 Réponse directe envoyée à ${msg.author.name}`);
                await delay(65000); // respect du rate limit
            } catch (err) {
                console.error(`❌ Erreur lors de la réponse à ${msg.author.name} : ${err}`);
                failedPMUsers.add(msg.author.name);
            }

            // ✅ Marque le message comme lu
            await msg.markAsRead();
        }
    }
}


async function mainLoop() {
    console.log('🔄 Exécution de la boucle principale...');

    if (cooldownUntil && Date.now() < cooldownUntil) {
        console.log('⏳ En pause à cause du ratelimit...');
        return;
    }

    try {
        await processPostComments();
        await processInboxMessages();
    } catch (err) {
        console.error(`Erreur dans mainLoop : ${err}`);
    }
}

function setPrivateMessage(msg) {
    privateMessage = msg;
}

function setDoneReplyMessage(msg) {
    doneReplyPM = msg;
}

let intervalId = null;

let dateActu = new Date();

async function startBot() {
    if (intervalId) return;
    intervalId = setInterval(mainLoop, 60000);
    dateActu = new Date();
}

async function stopBot() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

module.exports = {
    startBot,
    stopBot,
    setPrivateMessage,
    setDoneReplyMessage
};