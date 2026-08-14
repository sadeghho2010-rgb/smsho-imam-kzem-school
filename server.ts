import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

function getGenAIClient(customApiKey?: string) {
  const apiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("کلید API جمینای یافت نشد. لطفاً کلید API را وارد کنید یا در تنظیمات سیستم قرار دهید.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function generateContentWithFallback(client: GoogleGenAI, options: any) {
  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const res = await client.models.generateContent({
        ...options,
        model: modelName,
      });
      return res;
    } catch (err: any) {
      console.warn(`Model ${modelName} failed, trying next model... Error:`, err?.message || err);
      lastError = err;
    }
  }
  throw lastError || new Error("ارتباط با مدل‌های هوش مصنوعی با خطا مواجه شد.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON body parser with generous limit
  app.use(express.json({ limit: '20mb' }));

  // CORS and pre-flight handling
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // API Route for Gemini Multi-turn Chat
  app.post("/api/chat", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { studentData, history = [], message, customApiKey } = req.body;
      const client = getGenAIClient(customApiKey);

      const contents: any[] = [
        {
          role: 'user',
          parts: [{ text: `اطلاعات کامل پرونده طلبه جهت گفت‌وگو و مشاوره:\n${JSON.stringify(studentData, null, 2)}` }]
        },
        {
          role: 'model',
          parts: [{ text: 'اطلاعات کامل پرونده طلبه دریافت شد. آماده ارائه تحلیل، مشاوره و پاسخگویی بر اساس اطلاعات پرونده هستم.' }]
        }
      ];

      if (Array.isArray(history)) {
        for (const item of history) {
          contents.push({
            role: item.role === 'user' ? 'user' : 'model',
            parts: [{ text: item.content }]
          });
        }
      }

      if (message) {
        contents.push({
          role: 'user',
          parts: [{ text: message }]
        });
      }

      const response = await generateContentWithFallback(client, {
        contents,
        config: {
          systemInstruction: "شما یک مشاور و ارزیاب هوشمند آموزشی، پژوهشی و تربیتی حوزه علمیه هستید. با تحلیل دقیق داده‌های کامل طلبه (مشخصات، آمار مطالعه و تعهد، مقایسه با میانگین طلاب، نظرات و نمرات شفاهی اساتید، وضعیت پژوهش) به زبان فارسی، دقیق، محترمانه و کاربردی پاسخ دهید.",
        }
      });

      return res.json({ reply: response.text });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      return res.status(500).json({ error: error.message || "خطا در برقراری ارتباط با هوش مصنوعی" });
    }
  });

  // API Route for Gemini Analysis
  app.post("/api/analyze", async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    try {
      const { studentData, query, customApiKey } = req.body;
      const client = getGenAIClient(customApiKey);

      const prompt = `
        شما یک مشاور و ارزیاب آموزشی و تربیتی ارشد در حوزه علمیه هستید.
        بر اساس اطلاعات زیر که مربوط به یک طلبه است، تحلیل جامع و مفصلی ارائه دهید:

        اطلاعات کامل طلبه:
        ${JSON.stringify(studentData, null, 2)}

        درخواست / سوال کاربر:
        ${query || 'تحلیل جامع از وضعیت آموزشی، پژوهشی، اخلاقی، انضباطی و پیشنهادات رشد ارائه دهید.'}

        لطفا پاسخ را کاملا به زبان فارسی، ساختاریافته با پاراگراف‌ها و بالت‌پوینت‌های شفاف ارائه دهید.
      `;

      const response = await generateContentWithFallback(client, {
        contents: prompt,
      });

      return res.json({ analysis: response.text });
    } catch (error: any) {
      console.error("Gemini Analysis Error:", error);
      return res.status(500).json({ error: error.message || "Failed to analyze student data" });
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


