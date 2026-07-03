const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;
const wss = new WebSocket.Server({ port: PORT });

let nextID = 1;
const players = new Map();

const musicList = [
    { id: "mus_menu", duration: 90000 },
    { id: "mus_field", duration: 120000 },
    { id: "mus_night", duration: 105000 }
];

let currentMusic = 0;

function broadcast(obj)
{
    const packet = JSON.stringify(obj);

    wss.clients.forEach(client =>
    {
        if (client.readyState === WebSocket.OPEN)
        {
            client.send(packet);
        }
    });
}

function sendCurrentMusic(ws)
{
    ws.send(JSON.stringify({
        type: "music",
        music: musicList[currentMusic].id
    }));
}

function nextMusic()
{
    currentMusic++;

    if (currentMusic >= musicList.length)
        currentMusic = 0;

    console.log("♪ Música:", musicList[currentMusic].id);

    broadcast({
        type: "music",
        music: musicList[currentMusic].id
    });

    setTimeout(nextMusic, musicList[currentMusic].duration);
}

setTimeout(nextMusic, musicList[currentMusic].duration);

wss.on("connection", (ws) =>
{
    ws.id = nextID++;
    ws.username = "Anonimo";

    ws.x = 100;
    ws.y = 100;

    ws.spr = 0;
    ws.frame = 0;
    ws.speed = 0;

    players.set(ws.id, ws);

    console.log(`[+] Jugador ${ws.id}`);

    ws.send(JSON.stringify({
        type: "welcome",
        id: ws.id
    }));

    sendCurrentMusic(ws);

    for (const p of players.values())
    {
        if (p.id === ws.id) continue;

        ws.send(JSON.stringify({
            type: "spawn",
            id: p.id,
            name: p.username,
            x: p.x,
            y: p.y,
            spr: p.spr,
            frame: p.frame,
            speed: p.speed
        }));

        p.send(JSON.stringify({
            type: "spawn",
            id: ws.id,
            name: ws.username,
            x: ws.x,
            y: ws.y,
            spr: ws.spr,
            frame: ws.frame,
            speed: ws.speed
        }));
    }

    ws.on("message", (msg) =>
    {
        let raw = msg.toString().replace(/\0/g, "").trim();
        let packets = raw.split("}{");

        for (let i = 0; i < packets.length; i++)
        {
            let p = packets[i];
            if (i > 0) p = "{" + p;
            if (i < packets.length - 1) p += "}";

            try
            {
                const data = JSON.parse(p);
                if (!data.type) continue;

                switch (data.type)
                {
                    case "login":
                        ws.username = data.name || "Anonimo";

                        broadcast({
                            type: "spawn",
                            id: ws.id,
                            name: ws.username,
                            x: ws.x,
                            y: ws.y,
                            spr: ws.spr,
                            frame: ws.frame,
                            speed: ws.speed
                        });
                    break;

                    case "move":
                        ws.x = data.x || ws.x;
                        ws.y = data.y || ws.y;

                        ws.spr = data.spr ?? ws.spr;
                        ws.frame = data.frame ?? ws.frame;
                        ws.speed = data.speed ?? ws.speed;

                        wss.clients.forEach(client =>
                        {
                            if (client.readyState === WebSocket.OPEN && client !== ws)
                            {
                                client.send(JSON.stringify({
                                    type: "move",
                                    id: ws.id,
                                    name: ws.username,
                                    x: ws.x,
                                    y: ws.y,
                                    spr: ws.spr,
                                    frame: ws.frame,
                                    speed: ws.speed
                                }));
                            }
                        });
                    break;

                    case "chat":
                        broadcast({
                            type: "chat",
                            name: ws.username,
                            text: data.text || ""
                        });
                    break;
                }
            }
            catch (err)
            {
                console.log("Paquete inválido:", err.message);
            }
        }
    });

    ws.on("close", () =>
    {
        players.delete(ws.id);

        broadcast({
            type: "disconnect",
            id: ws.id
        });

        console.log(`[-] Jugador ${ws.id}`);
    });
});

console.log("Servidor listo en puerto " + PORT);
