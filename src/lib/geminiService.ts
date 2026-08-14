/**
 * Dedicated Gemini AI Service with Dual-Resilience
 * 1. Tries server-side /api/chat endpoint
 * 2. If server returns 405/404 or fails, falls back gracefully to direct client Gemini REST API when custom API key is present
 */

export interface ChatHistoryItem {
  role: 'user' | 'model';
  content: string;
}

export interface SendChatMessageOptions {
  studentData: any;
  history?: ChatHistoryItem[];
  message: string;
  customApiKey?: string;
}

async function callDirectGeminiApi(
  apiKey: string,
  contents: any[],
  systemInstructionText: string
): Promise<string> {
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = '';

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: systemInstructionText }]
          },
          generationConfig: {
            temperature: 0.7,
            topP: 0.95
          }
        })
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`خطای پاسخ نامعتبر از سرور گوگل (کد ${res.status})`);
      }

      if (!res.ok) {
        const errorMsg = data?.error?.message || `خطای مدل گوگل (${res.status})`;
        if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('API key not valid')) {
          throw new Error('کلید API وارد شده معتبر نیست. لطفاً در بخش «کلید API» یک کلید معتبر وارد کنید.');
        }
        if (errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
          throw new Error('سهمیه کلید API شما به پایان رسیده است یا نیاز به چند ثانیه صبر دارید.');
        }
        lastError = errorMsg;
        continue;
      }

      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (candidateText) {
        return candidateText;
      }
    } catch (err: any) {
      lastError = err?.message || 'خطا در ارتباط با هوش مصنوعی';
      if (err?.message?.includes('کلید API')) {
        throw err;
      }
    }
  }

  throw new Error(lastError || 'امکان دریافت پاسخ از مدل‌های هوش مصنوعی فراهم نشد.');
}

export async function sendChatMessage({
  studentData,
  history = [],
  message,
  customApiKey
}: SendChatMessageOptions): Promise<string> {
  const savedKey = customApiKey?.trim() || localStorage.getItem('gemini_api_key_custom')?.trim() || '';

  const systemInstruction = 'شما یک مشاور و ارزیاب هوشمند آموزشی، پژوهشی و تربیتی حوزه علمیه هستید. با تحلیل دقیق داده‌های کامل طلبه (مشخصات، آمار مطالعه و تعهد، مقایسه با میانگین طلاب، نظرات و نمرات شفاهی اساتید، وضعیت پژوهش) به زبان فارسی، دقیق، محترمانه و کاربردی پاسخ دهید.';

  const contentsPayload: any[] = [
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
      contentsPayload.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content }]
      });
    }
  }

  if (message) {
    contentsPayload.push({
      role: 'user',
      parts: [{ text: message }]
    });
  }

  // First: try server API
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentData,
        history,
        message,
        customApiKey: savedKey || undefined
      })
    });

    const responseText = await res.text();
    let data: any = null;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Server returned non-JSON (e.g. 405 Method Not Allowed or 404)
      if (savedKey) {
        return await callDirectGeminiApi(savedKey, contentsPayload, systemInstruction);
      }
      throw new Error(`خطای دریافت از سرور (${res.status}). لطفاً کلید اختصاصی API خود را از طریق دکمه «کلید API» وارد کنید.`);
    }

    if (!res.ok) {
      // If server returned error and we have client key, fallback to direct API
      if (savedKey && (res.status === 405 || res.status === 500 || res.status === 404)) {
        return await callDirectGeminiApi(savedKey, contentsPayload, systemInstruction);
      }
      throw new Error(data?.error || 'خطا در دریافت پاسخ از هوش مصنوعی');
    }

    if (data?.reply) {
      return data.reply;
    }
  } catch (err: any) {
    // If fetch failed completely (network / 405) and we have client key
    if (savedKey) {
      return await callDirectGeminiApi(savedKey, contentsPayload, systemInstruction);
    }
    throw err;
  }

  if (savedKey) {
    return await callDirectGeminiApi(savedKey, contentsPayload, systemInstruction);
  }

  throw new Error('پاسخی دریافت نشد. لطفاً کلید API را در بالای صفحه بررسی نمایید.');
}
