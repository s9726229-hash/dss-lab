import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, RecurringItem, AIReportData, Asset, PurchaseAssessment, BudgetConfig } from "../types";
import { getApiKey } from "./storage";
import { EXPENSE_CATEGORIES } from '../constants';

// AI 功能開關：暫時屏蔽 API 呼叫
export const AI_ENABLED = false;

// Helper to get AI instance dynamically with the latest key
const getAI = () => {
    if (!AI_ENABLED) throw new Error('AI Disabled');
    const key = getApiKey();
    if (!key) {
        console.warn("API Key is missing. Please set it in Settings.");
    }
    // Prevent crash if key is missing during initialization
    return new GoogleGenAI({ apiKey: key || 'dummy_key_to_prevent_crash' });
};

/**
 * Verifies if a given Gemini API key is valid by making a small test request.
 * @param key The API key to verify.
 * @returns A boolean indicating if the key is valid.
 */
export const verifyApiKey = async (key: string): Promise<boolean> => {
  if (!AI_ENABLED) return false;
  if (!key) return false;
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    // Use a simple, fast, and cheap model for the verification request.
    await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: 'test',
    });
    return true;
  } catch (error) {
    console.error("API Key verification failed:", error);
    return false;
  }
};


// Helper: Clean JSON string (remove markdown code blocks and trailing text)
const cleanJsonString = (text: string | undefined | null): string => {
    if (!text) return "[]";

    const textWithoutMarkdown = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const firstBrace = textWithoutMarkdown.indexOf('{');
    const firstBracket = textWithoutMarkdown.indexOf('[');
    
    let startIndex;
    if (firstBrace === -1) {
        startIndex = firstBracket;
    } else if (firstBracket === -1) {
        startIndex = firstBrace;
    } else {
        startIndex = Math.min(firstBrace, firstBracket);
    }

    if (startIndex === -1) {
        return "[]"; // No JSON found
    }
    
    const startChar = textWithoutMarkdown[startIndex];
    const endChar = (startChar === '{') ? '}' : ']';
    
    let openCount = 0;
    let endIndex = -1;

    for (let i = startIndex; i < textWithoutMarkdown.length; i++) {
        if (textWithoutMarkdown[i] === startChar) {
            openCount++;
        } else if (textWithoutMarkdown[i] === endChar) {
            openCount--;
        }
        
        if (openCount === 0) {
            endIndex = i;
            break;
        }
    }

    if (endIndex !== -1) {
        return textWithoutMarkdown.substring(startIndex, endIndex + 1);
    }
    
    return "[]"; // Incomplete JSON
};

/**
 * 分析語音或文字輸入的交易資訊
 */
export const parseTransactionInput = async (input: string): Promise<Partial<Transaction>[] | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `
        你是一位專業的財務助理。請分析下方的文字，將其中提到的所有交易項目拆解成 JSON 陣列。
        
        要求：
        1. 如果文字中包含多筆交易（例如：早餐50、午餐100），請拆分為多個獨立的物件。
        2. 類別請對應台灣常見口語（如：餐飲、交通、購物、娛樂、醫療、其他）。
        3. 若無指定日期，預設為：${new Date().toISOString().split('T')[0]}。
        
        輸入文字： "${input}"
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              date: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              category: { type: Type.STRING },
              item: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['EXPENSE', 'INCOME'] }
            },
            required: ['date', 'amount', 'category', 'item', 'type']
          }
        }
      }
    });

    const cleaned = cleanJsonString(response.text);
    const result = JSON.parse(cleaned);
    return Array.isArray(result) ? result : [result];
  } catch (error) {
    console.error("Gemini Multi-Parse Error:", error);
    return null;
  }
};

/**
 * Determines the most likely expense category for a transaction based on store name and items.
 */
export const categorizeExpense = async (storeName: string, items: string[]): Promise<string> => {
    const defaultCategory = '購物';
    try {
        const ai = getAI();
        const context = `${storeName} - ${items.slice(0, 3).join(', ')}`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents: `
                Based on the store name and item description, determine the most appropriate expense category.
                Please choose ONLY ONE category from the following list: [${EXPENSE_CATEGORIES.join(', ')}].
                Return only the category name as a single string.

                Context: "${context}"
            `,
        });

        const category = response.text?.trim();

        if (category && EXPENSE_CATEGORIES.includes(category)) {
            return category;
        }
        
        return defaultCategory; 

    } catch (error) {
        console.error("Gemini Categorization Error:", error);
        return defaultCategory;
    }
};

/**
 * 財務壓力測試與建議報告
 */
export const generateFinancialReport = async (
  assets: Asset[],
  transactions: Transaction[],
  recurring: RecurringItem[] = []
): Promise<AIReportData | null> => {
  try {
    const ai = getAI();
    
    const recentExpenses = transactions
        .filter(t => t.type === 'EXPENSE')
        .slice(0, 15)
        .map(t => ({ i: t.item, a: t.amount, c: t.category }));

    const context = {
      assetsSummary: {
          total: assets.reduce((sum, a) => a.type !== 'DEBT' ? sum + a.amount : sum, 0),
          debt: assets.reduce((sum, a) => a.type === 'DEBT' ? sum + a.amount : sum, 0),
          cash: assets.filter(a => a.type === 'CASH').reduce((sum, a) => sum + a.amount, 0)
      },
      debts: assets.filter(a => a.type === 'DEBT').map(a => ({ n: a.name, amt: a.amount })),
      recurring: recurring.map(r => ({ n: r.name, amt: r.amount, type: r.type, freq: r.frequency })),
      recentExpenses
    };

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `身為財務精算師，請根據以下資料進行壓力測試(DTI/現金流)與理財建議：${JSON.stringify(context)}。`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthScore: { type: Type.NUMBER, description: "0-100 score" },
            cashFlowForecast: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                    yearLabel: { type: Type.STRING },
                    monthlyFixedCost: { type: Type.NUMBER },
                    monthlyIncome: { type: Type.NUMBER },
                    debtToIncomeRatio: { type: Type.NUMBER },
                    isGracePeriodEnded: { type: Type.BOOLEAN },
                },
                required: ['yearLabel', 'debtToIncomeRatio']
              }
            },
            debtAnalysis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                     name: { type: Type.STRING },
                     status: { type: Type.STRING },
                     suggestion: { type: Type.STRING },
                },
                required: ['name', 'status', 'suggestion']
              }
            },
            summary: { type: Type.STRING },
          },
          required: ['healthScore', 'cashFlowForecast', 'debtAnalysis', 'summary']
        }
      }
    });

    const cleaned = cleanJsonString(response.text);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini Report Error", error);
    return null;
  }
};

export const analyzeRecurringHealth = async (items: RecurringItem[]): Promise<string> => {
  if (!AI_ENABLED) return "此功能目前已暫停。";
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `分析這些固定收支的健康狀況並提供繁體中文建議：${JSON.stringify(items)}`
  });
  return response.text || "";
};

export const analyzeLargeExpenses = async (transactions: Transaction[]): Promise<string> => {
  if (!AI_ENABLED) return "此功能目前已暫停。";
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: `分析大額支出並提供節流建議：${JSON.stringify(transactions)}`
  });
  return response.text || "";
};

export const evaluatePurchase = async (ctx: any, scenario: string): Promise<PurchaseAssessment | null> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `評估購買行為。情境：${scenario}。背景：${JSON.stringify(ctx)}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            status: { type: Type.STRING, enum: ['SAFE', 'WARNING', 'DANGER'] },
            analysis: { type: Type.STRING },
            impactOnCashFlow: { type: Type.STRING },
          },
          required: ['score', 'status', 'analysis', 'impactOnCashFlow'],
        },
      },
    });
    const cleaned = cleanJsonString(response.text);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Gemini Purchase Evaluation Error:", error);
    return null;
  }
};

export const generateBudgetSuggestions = async (transactions: Transaction[], recurring: RecurringItem[], budgets: BudgetConfig[]): Promise<BudgetConfig[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: `根據以下支出紀錄、固定收支以及現有預算設定，建議各類別的月預算上限。
        支出紀錄摘要: ${JSON.stringify(transactions.slice(-50))}
        固定收支: ${JSON.stringify(recurring)}
        目前預算: ${JSON.stringify(budgets)}
        請回傳 JSON 陣列，包含 category (繁體中文) 與 limit (數字)。`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              limit: { type: Type.NUMBER },
            },
            required: ['category', 'limit'],
          },
        },
      },
    });
    const cleaned = cleanJsonString(response.text);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Gemini Budget Suggestion Error:', error);
    return [];
  }
};