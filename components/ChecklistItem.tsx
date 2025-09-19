import React, { useState, useRef, useEffect } from 'react';
import { ChecklistItem as ChecklistItemType } from '../types';

interface ChecklistItemProps {
  item: ChecklistItemType;
  onToggle: (id: string) => void;
  onDeleteItem: (id: string, text: string) => void;
  onEdit: (id: string, newText: string) => void;
  categoryId: string;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, onToggle, onDeleteItem, onEdit, categoryId }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Fix: Corrected typo from `input-ref` to `inputRef`
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmedText = editText.trim();
    if (trimmedText && trimmedText !== item.text) {
      onEdit(item.id, trimmedText);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <li
      draggable={!isEditing}
      onDragStart={(e) => {
        if (isEditing) {
          e.preventDefault();
          return;
        }
        setIsDragging(true);
        e.dataTransfer.setData('application/json', JSON.stringify({ itemId: item.id, sourceCategoryId: categoryId }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd={() => setIsDragging(false)}
      onDoubleClick={() => !item.completed && setIsEditing(true)}
      className={`group flex items-center p-3 hover:bg-slate-50 rounded-lg transition-all duration-200 animate-slide-up relative ${isDragging ? 'opacity-50' : ''} ${isEditing ? 'bg-slate-100' : ''}`}
      style={{ animationDelay: '100ms', animationFillMode: 'backwards' }}
    >
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-grow bg-transparent border-b-2 border-indigo-500 focus:outline-none text-slate-700 mx-1"
        />
      ) : (
        <>
          <div 
            onClick={() => onToggle(item.id)}
            className={`w-5 h-5 flex-shrink-0 mr-4 rounded-md flex items-center justify-center border-2 transition-all duration-200 cursor-pointer ${item.completed ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300 bg-white'}`}
            aria-label={`Toggle item: ${item.text}`}
          >
            {item.completed && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <span className={`flex-grow text-slate-700 transition-colors duration-200 ${item.completed ? 'line-through text-slate-400' : 'cursor-text'}`}>
            {item.text}
          </span>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDeleteItem(item.id, item.text);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center bg-slate-200 text-slate-500 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all duration-200 focus:opacity-100 focus:ring-2 focus:ring-red-400"
            aria-label={`Delete item: ${item.text}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </>
      )}
    </li>
  );
};