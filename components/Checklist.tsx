import React, { useState } from 'react';
import { Category, ChecklistItem as ChecklistItemType } from '../types';
import { ChecklistItem } from './ChecklistItem';

interface ChecklistProps {
  categories: Category[];
  onToggleItem: (categoryId: string, itemId: string) => void;
  onMoveItem: (itemId: string, sourceCategoryId: string, destCategoryId: string) => void;
  onDeleteItem: (categoryId: string, itemId: string, itemText: string) => void;
  onDeleteCategory: (categoryId: string) => void;
  onEditItem: (categoryId: string, itemId: string, newText: string) => void;
}

export const Checklist: React.FC<ChecklistProps> = ({ categories, onToggleItem, onMoveItem, onDeleteItem, onDeleteCategory, onEditItem }) => {
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);

  if (categories.length === 0) {
    return null;
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, destCategoryId: string) => {
    e.preventDefault();
    setDragOverCategory(null);
    try {
      const { itemId, sourceCategoryId } = JSON.parse(e.dataTransfer.getData('application/json'));
      if (itemId && sourceCategoryId) {
        onMoveItem(itemId, sourceCategoryId, destCategoryId);
      }
    } catch (err) {
      console.error("Failed to parse drag-and-drop data:", err);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, categoryId: string) => {
    e.preventDefault();
    if (dragOverCategory !== categoryId) {
      setDragOverCategory(categoryId);
    }
  };

  return (
    <div className="w-full mt-8 space-y-6 animate-fade-in">
      {categories.map((category) => (
        <div 
          key={category.category} 
          onDrop={(e) => handleDrop(e, category.category)}
          onDragOver={(e) => handleDragOver(e, category.category)}
          onDragLeave={() => setDragOverCategory(null)}
          className={`bg-white p-6 rounded-xl shadow-md transition-all duration-200 ${dragOverCategory === category.category ? 'ring-2 ring-indigo-400 ring-offset-2 bg-indigo-50' : ''}`}
        >
          <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-3">
            <h2 className="text-xl font-bold text-slate-800">
              {category.category}
            </h2>
            <button 
              onClick={() => onDeleteCategory(category.category)}
              className="p-2 text-slate-400 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors duration-200"
              aria-label={`Delete category: ${category.category}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
          <ul className="space-y-2">
            {category.items.map((item) => (
              <ChecklistItem 
                key={item.id} 
                item={item} 
                onToggle={() => onToggleItem(category.category, item.id)}
                onDeleteItem={(itemId, itemText) => onDeleteItem(category.category, itemId, itemText)}
                onEdit={(itemId, newText) => onEditItem(category.category, itemId, newText)}
                categoryId={category.category}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};