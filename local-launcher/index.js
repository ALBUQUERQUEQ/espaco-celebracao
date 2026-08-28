import cors from 'cors';
import express from 'express';
import { spawn } from 'node:child_process';
const app = express();
const port = 8899;
const siteUrl = process.env.TOTEM_SITE_URL || 'https://seu-usuario.github.io/seu-repositorio';
const pages = ['esquerda.html', 'centro.html', 'direita.html'];
const monitorPositions = (process.env.TOTEM_MONITORS || '0,0;1920,0;3840,0').split(';').map((position) => {
    const [x, y] = position.split(',').map(Number);
    return { x: x || 0, y: y || 0 };
});

app.use(cors());
app.get('/health', (_request, response) => response.json({ ok: true }));

app.post('/start', async (_request, response) => {
    try {
        const browser = process.env.TOTEM_BROWSER || 'msedge.exe';
        if (monitorPositions.length < 3) return response.status(409).json({ error: 'Configure tres monitores' });

        for (let index = 0; index < 3; index += 1) {
            const screen = monitorPositions[index];
            const url = `${siteUrl}/frontend/${pages[index]}`;
            spawn(browser, [
                '--new-window', '--kiosk', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
                `--window-position=${screen.x},${screen.y}`, url,
            ], { detached: true, stdio: 'ignore' }).unref();
        }
        return response.json({ ok: true, monitors: 3 });
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
});

app.listen(port, '127.0.0.1', () => console.log(`Agente local em http://127.0.0.1:${port}`));
