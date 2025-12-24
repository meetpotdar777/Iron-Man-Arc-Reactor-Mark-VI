const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Use environment variables for the API Key
const API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json());

/**
 * Exponential Backoff Utility
 * Retries a fetch request up to 5 times with increasing delays
 */
async function fetchWithRetry(url, options, maxRetries = 5) {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) return response;
            
            // If rate limited (429) or server error (500+), retry
            if (response.status !== 429 && response.status < 500) return response;
        } catch (err) {
            if (i === maxRetries - 1) throw err;
        }
        await new Promise(res => setTimeout(res, delay));
        delay *= 2;
    }
}

/**
 * Endpoint: Chat with FRIDAY
 * Forwards user queries to gemini-2.5-flash-preview-09-2025
 */
app.post('/api/friday/chat', async (req, res) => {
    const { query } = req.body;

    const payload = {
        contents: [{ parts: [{ text: query }] }],
        systemInstruction: {
            parts: [{ text: "You are FRIDAY, Tony Stark's AI. Be professional, slightly witty, and have a clear Irish personality. Keep responses under 20 words." }]
        }
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${API_KEY}`;
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
        res.json({ reply });
    } catch (error) {
        res.status(500).json({ error: "Failed to reach FRIDAY neural link." });
    }
});

/**
 * Endpoint: FRIDAY Voice Synthesis (TTS)
 * Forwards text to gemini-2.5-flash-preview-tts
 */
app.post('/api/friday/speak', async (req, res) => {
    const { text } = req.body;

    const payload = {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: "Aoede" }
                }
            }
        },
        model: "gemini-2.5-flash-preview-tts"
    };

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${API_KEY}`;
        const response = await fetchWithRetry(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        
        if (!audioData) throw new Error("Audio synthesis failed");
        
        res.json(audioData);
    } catch (error) {
        res.status(500).json({ error: "Voice synthesis offline." });
    }
});

app.listen(PORT, () => {
    console.log(`Stark Industries Server running on port ${PORT}`);
});