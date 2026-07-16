
import { GoogleGenAI, Type } from "@google/genai";

// Ensure API_KEY is set in your environment variables
// Vite uses import.meta.env instead of process.env
const API_KEY = import.meta.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn("Gemini uchun API kaliti o'rnatilmagan. Sun'iy intellekt funksiyalari ishlamaydi.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

// Helper to get a deterministic word count estimate based on file size as a fallback.
const getDeterministicWordCountEstimate = (file: File): number => {
    const fileSizeInKB = file.size / 1024;
    let wordsPerKbEstimate = 120; // Default for docx
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'txt') {
        wordsPerKbEstimate = 200; // Plain text has less overhead
    } else if (extension === 'pdf') {
        wordsPerKbEstimate = 90; // PDF can be image-heavy
    }
    
    const wordCount = Math.round(fileSizeInKB * wordsPerKbEstimate);
    console.log(`Fallback estimation for ${file.name}: ${wordCount} words`);
    return Math.max(0, wordCount);
};

// Helper function to convert a File object to a base64 string
const fileToBase64 = (file: File): Promise<string> => 
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });

export const generateAbstractAndKeywords = async (articleText: string): Promise<{ abstract: string; keywords: string[] }> => {
  if (!API_KEY) return { abstract: "API Kaliti sozlanmagan.", keywords: [] };
  
  try {
    const prompt = `Ushbu ilmiy maqolaning matni asosida unga mos annotatsiya (taxminan 50-70 so'z) va 3-5 ta kalit so'zlar generatsiya qil. Matn: \n\n${articleText}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            abstract: {
              type: Type.STRING,
              description: "Maqolaning o'zbek tilidagi qisqacha annotatsiyasi."
            },
            keywords: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Maqolaga oid 3-5 ta kalit so'zlar ro'yxati."
            }
          },
          required: ["abstract", "keywords"]
        }
      }
    });

    const resultText = response.text.trim();
    const resultJson = JSON.parse(resultText);
    
    return {
        abstract: resultJson.abstract || '',
        keywords: resultJson.keywords || [],
    };

  } catch (error) {
    console.error("Annotatsiya va kalit so'zlarni generatsiya qilishda xatolik:", error);
    return { abstract: "Kontent generatsiya qilishda xatolik yuz berdi.", keywords: [] };
  }
};

export const rephraseText = async (text: string): Promise<string> => {
    if (!API_KEY) return "API Kaliti sozlanmagan.";

    try {
      const prompt = `Quyidagi matnni ilmiy uslubda, ma'nosini saqlagan holda qayta yozib ber (rephrasing). Matn: "${text}"`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });
      return response.text;
    } catch (error) {
        console.error("Matnni qayta yozishda xatolik:", error);
        return "Kontent generatsiya qilishda xatolik yuz berdi.";
    }
};

export const formatReferences = async (references: string, style: 'APA' | 'MLA' | 'Chicago'): Promise<string> => {
    if (!API_KEY) return "API Kaliti sozlanmagan.";
    try {
        const prompt = `Quyidagi adabiyotlar ro'yxatini ${style} standartiga muvofiq formatlab ber. Har bir manbani alohida qatordan yoz.\n\n${references}`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Adabiyotlarni formatlashda xatolik:", error);
        return "Adabiyotlarni formatlashda xatolik yuz berdi.";
    }
};

export const transliterateText = async (text: string, direction: 'cyr_to_lat' | 'lat_to_cyr'): Promise<string> => {
    if (!API_KEY) return "API Kaliti sozlanmagan.";
    try {
        const prompt = direction === 'cyr_to_lat' 
            ? `Quyidagi kirill alifbosidagi matnni lotin alifbosiga o'girib ber: "${text}"`
            : `Quyidagi lotin alifbosidagi matnni kirill alifbosiga o'girib ber: "${text}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Matnni transliteratsiya qilishda xatolik:", error);
        return "Transliteratsiya qilishda xatolik yuz berdi.";
    }
};

export const getWordCount = async (file: File): Promise<number> => {
  if (!API_KEY) {
    console.warn("API kaliti sozlanmagan, so'zlarni sanash uchun taxminiy hisoblash ishlatilmoqda.");
    return getDeterministicWordCountEstimate(file);
  }

  try {
    let mimeType = file.type;
    
    // Fallback for MIME type detection
    if (!mimeType) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') {
            mimeType = 'application/pdf';
        } else if (extension === 'txt') {
            mimeType = 'text/plain';
        } else if (extension === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        }
    }
    
    // Gemini API has limited support for document MIME types for direct analysis.
    // Use fallback for unsupported types like .docx to prevent API errors.
    const supportedMimeTypesForWordCount = ['application/pdf', 'text/plain'];
    if (!mimeType || !supportedMimeTypesForWordCount.includes(mimeType)) {
        console.warn(`"${mimeType || 'unknown'}" MIME turi Gemini tomonidan qo'llab-quvvatlanmaydi. Taxminiy hisoblashga o'tilmoqda.`);
        return getDeterministicWordCountEstimate(file);
    }
    
    const base64Data = await fileToBase64(file);

    const filePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType,
      },
    };

    const promptPart = {
      text: "Ushbu hujjatdagi so'zlarning aniq sonini hisoblang. Javobingiz faqat JSON formatida bo'lsin va 'wordCount' kalitiga ega bo'lsin. Boshqa hech qanday matn qo'shmang.",
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: { parts: [filePart, promptPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            wordCount: {
              type: Type.INTEGER,
              description: "Hujjatdagi so'zlarning aniq soni."
            }
          },
          required: ["wordCount"]
        }
      }
    });
    
    const resultText = response.text.trim();
    const resultJson = JSON.parse(resultText);
    const wordCount = resultJson.wordCount;

    if (typeof wordCount !== 'number' || isNaN(wordCount)) {
      console.error("Gemini-dan so'zlar sonini aniqlashda not'g'ri formatdagi javob keldi:", resultText);
      throw new Error("Could not parse word count from AI response.");
    }

    return wordCount;

  } catch (error) {
    console.error("Gemini yordamida so'zlarni sanashda xatolik:", error);
    // Fallback to estimation on any API error
    return getDeterministicWordCountEstimate(file);
  }
};
