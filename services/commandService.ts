import { GoogleGenAI, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the expected JSON structure from the AI
const commandResponseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: "The user's primary intent. Must be one of: 'ADD', 'REMOVE', 'CLEAR', or 'UNKNOWN'.",
    },
    items: {
      type: Type.ARRAY,
      description: "A list of items mentioned by the user. This can be empty, for example with the 'CLEAR' intent.",
      items: {
        type: Type.STRING,
      },
    },
  },
  required: ["intent", "items"],
};

export interface Command {
  intent: 'ADD' | 'REMOVE' | 'CLEAR' | 'UNKNOWN';
  items: string[];
}

export const processCommand = async (text: string): Promise<Command> => {
    try {
        const prompt = `
        Analyze the user's request to understand their intent and identify any specific items.

        Possible intents are:
        - 'ADD': The user wants to add one or more items to their list.
        - 'REMOVE': The user wants to remove one or more items from the list.
        - 'CLEAR': The user wants to delete or clear the entire list.
        - 'UNKNOWN': The intent is not clear, is a general question, or is just a statement.

        Extract all specific items mentioned. For example, in "please add milk and bread to my shopping list", the items are ["milk", "bread"]. In "can you remove the eggs for me", the item is ["eggs"].

        User request: "${text}"

        Return your analysis in the exact JSON format specified by the schema.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: commandResponseSchema,
            },
        });

        const jsonString = response.text;
        const parsedJson = JSON.parse(jsonString);

        // Validate the response from the AI to ensure it matches our expected Command interface
        if (
            parsedJson &&
            typeof parsedJson.intent === 'string' &&
            ['ADD', 'REMOVE', 'CLEAR', 'UNKNOWN'].includes(parsedJson.intent) &&
            Array.isArray(parsedJson.items)
        ) {
            return parsedJson as Command;
        }

        console.warn("AI response did not match the expected command schema:", parsedJson);
        return { intent: 'UNKNOWN', items: [] };

    } catch (error) {
        console.error("Error processing natural language command:", error);
        // In case of any failure in the AI call, we default to an UNKNOWN command
        return { intent: 'UNKNOWN', items: [] };
    }
};
