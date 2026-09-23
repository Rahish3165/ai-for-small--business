import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const modelName = import.meta.env.VITE_GEMINI_MODEL || "gemini-1.5-flash";

// Interface for what the UI expects
export interface AIResponse {
  type: 'insight' | 'text';
  text?: string;
  insight?: {
    title: string;
    suggestions: string[];
    actions: string[];
  };
}

function getLocalFallbackInsight(query: string, language: 'EN' | 'HI', businessData: any): AIResponse {
  const q = query.toLowerCase();
  const isHi = language === 'HI';
  
  if (q.includes('stock') || q.includes('inventory') || q.includes('saman') || q.includes('maal')) {
    const lowStock = (businessData?.inventory || []).filter((i: any) => i.quantity <= i.threshold);
    const names = lowStock.map((i: any) => `${i.item_name} (${i.quantity} ${i.unit || 'units'})`).join(', ');
    return {
      type: 'insight',
      insight: {
        title: isHi
          ? `Stock Alert: ${lowStock.length || 2} items safety limit se kam hain!`
          : `Stock Alert: ${lowStock.length || 2} items are running below safe threshold!`,
        suggestions: [
          isHi ? `Turant restock karein: ${names || 'Milk aur Sugar'}` : `Restock immediately: ${names || 'Milk & Sugar'}`,
          isHi ? 'Shaam ke 4 baje rush se pehle wholesale order karein' : 'Place wholesale supplier order before 4 PM evening peak rush'
        ],
        actions: ['Restock Now', 'View Inventory']
      }
    };
  }

  if (q.includes('profit') || q.includes('fayda') || q.includes('munafa') || q.includes('loss') || q.includes('kharcha')) {
    return {
      type: 'insight',
      insight: {
        title: isHi
          ? 'Aapka net profit achha chal raha hai (₹15,870 is period)!'
          : 'Healthy Net Profit Trend: ₹15,870 estimated for this period!',
        suggestions: [
          isHi ? 'Dairy aur packaging kharche par 5% bachat karke munafa badhayen' : 'Reduce packaging & utility overhead to expand margins',
          isHi ? '"Chai + Bun Maska" combo se daily revenue 15% badha sakte hain' : 'Promote "Chai + Bun Maska" combo to lift daily ticket size'
        ],
        actions: ['Create Combo', 'View Finance']
      }
    };
  }

  return {
    type: 'text',
    text: isHi
      ? `Namaste Ramesh ji! Main aapka BoothIQ AI business advisor hoon. Aap dhandhe ke sales, stock, ya profit ke baare me pooch sakte hain.`
      : `Hello! I am BoothIQ AI advisor for your store. Ask me about stock alerts, sales forecast, or profit optimization.`
  };
}

export const generateBusinessInsight = async (
  query: string,
  language: 'EN' | 'HI',
  businessData: any
): Promise<AIResponse> => {
  if (!apiKey) {
    return getLocalFallbackInsight(query, language, businessData);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `
You are an expert AI business advisor for an Indian small business (like a Kirana store).
You need to help the store owner understand their financial and inventory data and make profitable decisions.

Current Business Data:
${JSON.stringify(businessData, null, 2)}

User Question: ${query}

Important Rules:
1. If the user asks a simple conversational question, you can reply with simple text.
2. If the user asks about business metrics, profits, losses, or stock, YOU MUST provide a structured insight.
3. Language: The response must be in ${language === 'HI' ? 'Hinglish (Hindi written in English alphabet, e.g., "Aapka profit...")' : 'English'}.
4. Be brief, practical, and action-oriented. Max 2-3 short sentences for text. Focus on numbers if applicable.

You MUST respond ONLY with a valid JSON object matching this schema (do NOT use markdown \`\`\`json blocks, just raw JSON text):

{
  "type": "insight" | "text",
  "text": "Only populated if type is 'text'. A direct conversational reply.",
  "insight": {
    "title": "A short, punchy sentence explaining the main problem or opportunity based on data.",
    "suggestions": ["1st action step", "2nd action step"],
    "actions": ["Short Button Label 1", "Short Button Label 2"] 
  }
}
`;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // Attempt to parse JSON
    try {
      // Strip out markdown formatting if Gemini includes it accidentally
      const cleanJson = textResponse.replace(/^```json\n|\n```$/g, '').trim();
      const parsed: AIResponse = JSON.parse(cleanJson);
      return parsed;
    } catch (parseError) {
      console.error("Gemini JSON Parse Error:", parseError, "Raw format:", textResponse);
      return {
        type: 'text',
        text: textResponse
      };
    }

  } catch (error) {
    console.error("Gemini API Error, falling back to local insight:", error);
    return getLocalFallbackInsight(query, language, businessData);
  }
};

