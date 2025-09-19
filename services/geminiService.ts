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

export const generateChecklistFromUrl = async (url: string): Promise<Category[]> => {
    try {
        // Fix: Since `responseSchema` is not allowed with the `googleSearch` tool,
        // the required JSON output structure is described directly in the prompt.
        const prompt = `
        Access the recipe from the provided URL, extract every ingredient with its quantity, and organize them into a categorized grocery list.
        The categories should be based on common supermarket aisles (e.g., "Produce", "Dairy & Eggs", "Pantry Staples").
        You MUST return the data as a valid JSON array of objects.
        
        Each object in the array represents a category and must have two properties:
        1. "category": A string for the aisle name.
        2. "items": An array of ingredient objects.

        Each ingredient object must have two properties:
        1. "quantity": A string for the ingredient's amount (e.g., "1 cup", "2 tbsp").
        2. "ingredient": A string for the name of the ingredient (e.g., "all-purpose flour").

        Do not omit any ingredients.

        Recipe URL: "${url}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
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
