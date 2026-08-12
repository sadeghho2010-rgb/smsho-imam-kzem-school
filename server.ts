import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Gemini Analysis
  app.post("/api/analyze", async (req, res) => {
    try {
      const { studentData, query } = req.body;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Gemini API key is not configured." });
      }

      const prompt = `
        You are an expert educational advisor in a religious school (Howza).
        Analyze the following student's data and provide a detailed analysis based on the user's request.
        
        Student Data:
        ${JSON.stringify(studentData, null, 2)}
        
        User Request/Query:
        ${query}
        
        Please provide the analysis in Persian (Farsi). Focus on academic progress, behavioral patterns from teacher comments, attendance, and study habits.
      `;

      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: prompt,
      });

      res.json({ analysis: interaction.output_text });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      res.status(500).json({ error: error.message || "Failed to analyze student data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
