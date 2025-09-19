import { Category } from '../types';

// In a real application, this service would make API calls to a backend server
// that connects to a database like Cloud SQL. For this demonstration, we are
// using the browser's localStorage to simulate a persistent data store.

const LOCAL_STORAGE_KEY = 'intellilist-data';
const API_LATENCY_MS = 300; // Simulate network delay

/**
 * Fetches the checklist from the simulated backend (localStorage).
 * @returns A promise that resolves to the array of categories.
 */
export const getChecklist = async (): Promise<Category[]> => {
  console.log("Fetching checklist from service...");
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          if (Array.isArray(parsedData)) {
            resolve(parsedData);
          }
        }
        resolve([]); // Resolve with empty array if no data or invalid data
      } catch (error) {
        console.error("Failed to load checklist from mock API (localStorage)", error);
        resolve([]); // On error, return an empty list
      }
    }, API_LATENCY_MS);
  });
};

/**
 * Saves the entire checklist to the simulated backend (localStorage).
 * @param data The array of categories to save.
 * @returns A promise that resolves when the save is complete.
 */
export const saveChecklist = async (data: Category[]): Promise<void> => {
    console.log("Saving checklist to service...");
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
        resolve();
      } catch (error) {
        console.error("Failed to save checklist to mock API (localStorage)", error);
        reject(new Error("Failed to save data."));
      }
    }, API_LATENCY_MS);
  });
};
