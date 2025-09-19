import { GoogleGenAI, Type } from "@google/genai";
import { Category } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const textResponseSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "A smart category for the checklist items. For groceries, use store aisles (e.g., 'Produce', 'Dairy'). For tasks, use contexts (e.g., '@home', '@work'). Always create a logical category, even for a single item."
      },
      items: {
        type: Type.ARRAY,
        description: "A list of individual tasks or items belonging to this category.",
        items: {
          type: Type.STRING,
        },
      },
    },
    required: ["category", "items"],
  },
};

export const generateChecklistFromText = async (text: string): Promise<Category[]> => {
    try {
        const prompt = `
        Analyze the user's text and organize all items into a categorized checklist.
        - For groceries, group items by supermarket aisle (e.g., "Produce", "Dairy & Eggs").
        - For to-dos, group tasks by context (e.g., "@home", "@errands", "Project").
        - Always create a logical category for every item.

        User text: "${text}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: textResponseSchema,
            },
        });
        
        const jsonString = response.text;
        if (!jsonString || jsonString.trim() === '' || jsonString.trim() === '[]') {
          return [];
        }

        const parsedJson = JSON.parse(jsonString);
        
        if (!Array.isArray(parsedJson) || parsedJson.length === 0) {
            return [];
        }

        // Transform the raw response into our application's data structure
        const structuredChecklist: Category[] = parsedJson
            .filter(cat => cat && cat.category && Array.isArray(cat.items) && cat.items.length > 0)
            .map((cat: { category: string; items: string[] }) => ({
                category: cat.category,
                items: cat.items.map(itemText => ({
                    id: crypto.randomUUID(),
                    text: itemText,
                    completed: false,
                })),
            }));

        return structuredChecklist;

    } catch (error) {
        console.error("Error generating checklist from text:", error);
        // Return an empty array to allow the UI to display a user-friendly error message.
        return [];
    }
};

const urlResponseSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            category: {
                type: Type.STRING,
                description: "A supermarket aisle category, e.g., 'Produce' or 'Pantry Staples'."
            },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        quantity: {
                            type: Type.STRING,
                            description: "The amount or measurement of the ingredient, e.g., '1 cup', '2 tbsp', '100g'. If no quantity is specified in the recipe, you may leave this as an empty string."
                        },
                        ingredient: {
                            type: Type.STRING,
                            description: "The name of the ingredient, e.g., 'all-purpose flour' or 'large eggs'."
                        },
                    },
                    required: ["quantity", "ingredient"],
                },
            },
        },
        required: ["category", "items"],
    },
};


export const generateChecklistFromUrl = async (url: string): Promise<Category[]> => {
    try {
        const prompt = `
        Access the recipe from the URL: "${url}"
        Your primary task is to extract every single ingredient and its corresponding quantity. Do not omit any items or quantities.
        After extracting, categorize all ingredients into a grocery list based on common supermarket aisles (e.g., Produce, Dairy & Eggs, Pantry Staples).
        You MUST return the data in the exact JSON format specified by the schema. Ensure the 'quantity' field is always populated, even if it's just a number.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                // Fix: `responseMimeType` and `responseSchema` are not allowed when using the `googleSearch` tool.
                tools: [{googleSearch: {}}],
            },
        });
        
        const jsonString = response.text;
        if (!jsonString || jsonString.trim() === '' || jsonString.trim() === '[]') {
            return [];
        }

        const parsedJson = JSON.parse(jsonString);

        if (!Array.isArray(parsedJson) || parsedJson.length === 0) {
            return [];
        }

        interface RawIngredientItem {
            quantity: string;
            ingredient: string;
        }
        
        const structuredChecklist: Category[] = parsedJson
            .filter(cat => cat && cat.category && Array.isArray(cat.items) && cat.items.length > 0)
            .map((cat: { category: string; items: RawIngredientItem[] }) => ({
                category: cat.category,
                items: cat.items.map(item => ({
                    id: crypto.randomUUID(),
                    text: `${item.quantity || ''} ${item.ingredient}`.trim(),
                    completed: false,
                })),
            }));

        return structuredChecklist;

    } catch (error) {
        console.error("Error generating checklist from URL:", error);
        // Return an empty array to allow the UI to display a user-friendly error message.
        return [];
    }
};