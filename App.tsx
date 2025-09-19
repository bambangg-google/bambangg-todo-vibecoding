import React, { useState, useEffect } from 'react';
import { InputForm } from './components/InputForm';
import { Checklist } from './components/Checklist';
import { ConfirmationModal } from './components/ConfirmationModal';
import { Category } from './types';
import { generateChecklistFromText, generateChecklistFromUrl } from './services/geminiService';
import { processCommand, Command } from './services/commandService';
import * as checklistService from './services/checklistService';

const URL_REGEX = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;

const App: React.FC = () => {
    const [userInput, setUserInput] = useState('');
    const [categories, setCategories] = useState<Category[]>(() => {
        try {
            const savedList = localStorage.getItem('smart-checklist');
            return savedList ? JSON.parse(savedList) : [];
        } catch (e) {
            console.error("Failed to load from local storage", e);
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [modalState, setModalState] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });

    useEffect(() => {
        try {
            localStorage.setItem('smart-checklist', JSON.stringify(categories));
        } catch (e) {
            console.error("Failed to save to local storage", e);
        }
    }, [categories]);

    const handleCommand = async (command: Command) => {
        if (command.intent === 'ADD') {
            setCategories(prev => checklistService.addItems(prev, command.items));
        } else if (command.intent === 'REMOVE') {
            setCategories(prev => checklistService.removeItems(prev, command.items));
        } else if (command.intent === 'CLEAR') {
            handleDeleteAll();
        } else {
            setError(`Sorry, I didn't understand that. Please try rephrasing your request.`);
        }
        setUserInput('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedInput = userInput.trim();
        if (!trimmedInput || isLoading) return;

        setIsLoading(true);
        setError(null);

        try {
            if (categories.length > 0) {
                const command = await processCommand(trimmedInput);
                if (command.intent !== 'UNKNOWN') {
                    await handleCommand(command);
                    return;
                }
            }
            
            let newCategories: Category[];
            if (URL_REGEX.test(trimmedInput)) {
                newCategories = await generateChecklistFromUrl(trimmedInput);
            } else {
                newCategories = await generateChecklistFromText(trimmedInput);
            }

            if (newCategories.length === 0) {
                setError("Couldn't generate a checklist from your input. Please try again with more details or a different URL.");
            } else {
                setCategories(newCategories);
                setUserInput('');
            }
        } catch (err) {
            console.error("Error during submission:", err);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const onToggleItem = (categoryId: string, itemId: string) => {
        setCategories(prev => checklistService.toggleItem(prev, categoryId, itemId));
    };

    const onMoveItem = (itemId: string, sourceCategoryId: string, destCategoryId: string) => {
        setCategories(prev => checklistService.moveItem(prev, itemId, sourceCategoryId, destCategoryId));
    };

    const onDeleteItem = (categoryId: string, itemId: string, itemText: string) => {
        setModalState({
            isOpen: true,
            title: `Delete "${itemText}"?`,
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: () => {
                setCategories(prev => checklistService.deleteItem(prev, categoryId, itemId));
                closeModal();
            },
        });
    };

    const onDeleteCategory = (categoryId: string) => {
        setModalState({
            isOpen: true,
            title: `Delete "${categoryId}" category?`,
            message: 'Are you sure you want to delete this entire category and all its items? This action cannot be undone.',
            onConfirm: () => {
                setCategories(prev => checklistService.deleteCategory(prev, categoryId));
                closeModal();
            },
        });
    };

    const onEditItem = (categoryId: string, itemId: string, newText: string) => {
        setCategories(prev => checklistService.editItem(prev, categoryId, itemId, newText));
    };
    
    const handleDeleteAll = () => {
        setModalState({
            isOpen: true,
            title: 'Delete entire checklist?',
            message: 'Are you sure you want to delete the entire checklist? This action cannot be undone.',
            onConfirm: () => {
                setCategories([]);
                closeModal();
            },
        });
    };
    
    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="bg-slate-50 min-h-screen font-sans">
            <main className="container mx-auto p-4 sm:p-6 md:p-8 max-w-3xl">
                <header className="text-center my-8 animate-fade-in">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 tracking-tight">
                        ✨ Smart Checklist ✨
                    </h1>
                    <p className="text-slate-500 mt-3 text-lg">
                        Instantly turn thoughts, notes, or recipe links into organized checklists with AI.
                    </p>
                </header>

                <div className="bg-white p-6 rounded-2xl shadow-lg">
                    <InputForm
                        userInput={userInput}
                        setUserInput={setUserInput}
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        hasExistingList={categories.length > 0}
                    />
                </div>

                {error && (
                    <div className="mt-4 p-4 bg-red-100 text-red-700 border border-red-200 rounded-lg animate-fade-in" role="alert">
                        {error}
                    </div>
                )}
                
                {categories.length > 0 && !isLoading && (
                    <Checklist
                        categories={categories}
                        onToggleItem={onToggleItem}
                        onMoveItem={onMoveItem}
                        onDeleteItem={onDeleteItem}
                        onDeleteCategory={onDeleteCategory}
                        onEditItem={onEditItem}
                    />
                )}
            </main>
            
            <ConfirmationModal
                isOpen={modalState.isOpen}
                title={modalState.title}
                message={modalState.message}
                onConfirm={modalState.onConfirm}
                onCancel={closeModal}
            />
        </div>
    );
};

export default App;
