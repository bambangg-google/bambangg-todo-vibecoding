import React, { useState, useCallback, useEffect } from 'react';
import { Category, ChecklistItem as ChecklistItemType } from './types';
import { generateChecklistFromText, generateChecklistFromUrl } from './services/geminiService';
import { processCommand } from './services/commandService';
import { getChecklist, saveChecklist } from './services/checklistService';
import { InputForm } from './components/InputForm';
import { Checklist } from './components/Checklist';
import { Loader } from './components/Loader';
import { ConfirmationModal } from './components/ConfirmationModal';

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: (() => void) | null;
}

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [checklistData, setChecklistData] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
  });

  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitializing(true);
      setError(null);
      try {
        const data = await getChecklist();
        setChecklistData(data);
      } catch (err) {
        setError("Could not load your saved list. Please try refreshing the page.");
      } finally {
        setIsInitializing(false);
      }
    };
    loadInitialData();
  }, []);

  const handleAddItems = useCallback(async (itemsAsText: string) => {
      const generatedChecklist = await generateChecklistFromText(itemsAsText);

      if (generatedChecklist.length === 0) {
        setError("Couldn't extract any items from your request. Try phrasing your list differently.");
        return;
      }
      
      setChecklistData(prevData => {
        const mergedData = [...prevData];
        const categoryMap = new Map(mergedData.map(cat => [cat.category, cat]));

        generatedChecklist.forEach(newCategory => {
          const existingCategory = categoryMap.get(newCategory.category);
          if (existingCategory) {
            const existingItemTexts = new Set(existingCategory.items.map(item => item.text.toLowerCase()));
            newCategory.items.forEach(newItem => {
              if (!existingItemTexts.has(newItem.text.toLowerCase())) {
                existingCategory.items.push(newItem);
              }
            });
          } else {
            mergedData.push(newCategory);
            categoryMap.set(newCategory.category, newCategory);
          }
        });
        saveChecklist(mergedData);
        return mergedData;
      });
      setUserInput(''); // Clear input after successful addition
  }, []);


  const handleSubmitInput = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedInput = userInput.trim();
    if (!trimmedInput) {
      setError("Please enter some text or a recipe URL.");
      return;
    }

    const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    const isUrl = urlRegex.test(trimmedInput);
    
    setIsLoading(true);
    setError(null);

    try {
      if (isUrl) {
        const generatedChecklist = await generateChecklistFromUrl(trimmedInput);
         if (generatedChecklist.length === 0) {
            setError("Could not find a recipe at that URL. Please check the link and try again.");
         } else {
            await handleAddItems(generatedChecklist.map(c => c.items.map(i => i.text).join(', ')).join(', '));
         }
      } else {
        // Process natural language command
        const command = await processCommand(trimmedInput);
        
        switch (command.intent) {
          case 'ADD':
            if (command.items.length === 0) {
              setError("I see you want to add something, but I couldn't figure out what. Please be more specific.");
              break;
            }
            await handleAddItems(command.items.join(', '));
            break;
          
          case 'REMOVE':
            if (command.items.length === 0) {
              setError("I see you want to remove something, but I couldn't figure out what. Please be more specific.");
              break;
            }
            requestRemoveItems(command.items);
            setUserInput('');
            break;
          
          case 'CLEAR':
            requestClearList();
            setUserInput('');
            break;

          case 'UNKNOWN':
          default:
            // Fallback: Treat the entire input as a list of items to add.
            await handleAddItems(trimmedInput);
            break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [userInput, handleAddItems]);


  const handleToggleItem = useCallback(async (categoryId: string, itemId: string) => {
    const updatedData = checklistData.map(category => {
      if (category.category === categoryId) {
        return {
          ...category,
          items: category.items.map(item => {
            if (item.id === itemId) {
              return { ...item, completed: !item.completed };
            }
            return item;
          }),
        };
      }
      return category;
    });
    setChecklistData(updatedData);
    try {
      await saveChecklist(updatedData);
    } catch (err) {
      setError("Your changes could not be saved. Please try again.");
      setChecklistData(checklistData);
    }
  }, [checklistData]);

  const handleMoveItem = useCallback(async (itemId: string, sourceCategoryId: string, destCategoryId: string) => {
    if (sourceCategoryId === destCategoryId) return;
    let itemToMove: ChecklistItemType | null = null;
    const nextChecklistData = JSON.parse(JSON.stringify(checklistData));
    const sourceCategory = nextChecklistData.find((c: Category) => c.category === sourceCategoryId);
    if (!sourceCategory) return;
    const itemIndex = sourceCategory.items.findIndex((it: ChecklistItemType) => it.id === itemId);
    if (itemIndex > -1) {
      itemToMove = sourceCategory.items[itemIndex];
      sourceCategory.items.splice(itemIndex, 1);
    }
    if (!itemToMove) return;
    const destCategory = nextChecklistData.find((c: Category) => c.category === destCategoryId);
    if (destCategory) {
      destCategory.items.push(itemToMove);
    }
    const finalData = nextChecklistData.filter((c: Category) => c.items.length > 0);
    setChecklistData(finalData);
    try {
      await saveChecklist(finalData);
    } catch (err) {
      setError("Your changes could not be saved. Please try again.");
      setChecklistData(checklistData); 
    }
  }, [checklistData]);

  const handleEditItem = useCallback(async (categoryId: string, itemId: string, newText: string) => {
    const updatedData = checklistData.map(category => {
      if (category.category === categoryId) {
        return {
          ...category,
          items: category.items.map(item => {
            if (item.id === itemId) {
              return { ...item, text: newText };
            }
            return item;
          }),
        };
      }
      return category;
    });

    setChecklistData(updatedData);
    try {
      await saveChecklist(updatedData);
    } catch (err) {
      setError("Your changes could not be saved. Please try again.");
      setChecklistData(checklistData);
    }
  }, [checklistData]);
  
  const handleDeleteItem = useCallback((categoryId: string, itemId: string) => {
    const updatedData = checklistData.map(category => {
        if (category.category === categoryId) {
            return {
                ...category,
                items: category.items.filter(item => item.id !== itemId),
            };
        }
        return category;
    }).filter(category => category.items.length > 0);
    setChecklistData(updatedData);
    saveChecklist(updatedData).catch(() => {
        setError("Failed to save deletion. Please try again.");
        setChecklistData(checklistData);
    });
  }, [checklistData]);

  const handleDeleteCategory = useCallback((categoryId: string) => {
    const updatedData = checklistData.filter(category => category.category !== categoryId);
    setChecklistData(updatedData);
    saveChecklist(updatedData).catch(() => {
        setError("Failed to save deletion. Please try again.");
        setChecklistData(checklistData);
    });
  }, [checklistData]);

  const handleRemoveItemsByText = useCallback((itemsToRemove: string[]) => {
    const lowerCaseItemsToRemove = itemsToRemove.map(item => item.toLowerCase());
    const updatedData = checklistData.map(category => {
        const newItems = category.items.filter(item => {
            const itemTextLower = item.text.toLowerCase();
            return !lowerCaseItemsToRemove.some(removeItem => itemTextLower.includes(removeItem));
        });
        return { ...category, items: newItems };
    }).filter(category => category.items.length > 0);

    setChecklistData(updatedData);
    saveChecklist(updatedData).catch(() => {
        setError("Failed to save deletion. Please try again.");
        setChecklistData(checklistData);
    });
  }, [checklistData]);

  const handleClearList = useCallback(() => {
    setChecklistData([]);
    saveChecklist([]).catch(() => {
        setError("Failed to save deletion. Please try again.");
        setChecklistData(checklistData);
    });
  }, [checklistData]);

  const requestDeleteItem = (categoryId: string, itemId: string, itemText: string) => {
    setModalState({
      isOpen: true,
      title: 'Delete Item?',
      message: `Are you sure you want to delete the item: "${itemText}"?`,
      onConfirm: () => {
        handleDeleteItem(categoryId, itemId);
        closeModal();
      },
    });
  };

  const requestDeleteCategory = (categoryId: string) => {
    setModalState({
      isOpen: true,
      title: 'Delete Category?',
      message: `Are you sure you want to delete the "${categoryId}" category and all its items?`,
      onConfirm: () => {
        handleDeleteCategory(categoryId);
        closeModal();
      },
    });
  };
  
  const requestRemoveItems = (items: string[]) => {
    setModalState({
        isOpen: true,
        title: 'Remove Items?',
        message: `Are you sure you want to remove items matching: "${items.join(', ')}"?`,
        onConfirm: () => {
            handleRemoveItemsByText(items);
            closeModal();
        },
    });
  };

  const requestClearList = () => {
    setModalState({
        isOpen: true,
        title: 'Clear Entire List?',
        message: 'Are you sure you want to delete all categories and items? This action cannot be undone.',
        onConfirm: () => {
            handleClearList();
            closeModal();
        },
    });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, title: '', message: '', onConfirm: null });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl mx-auto">
        <header className="text-center my-8 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-800 tracking-tight">
            IntelliList <span className="text-indigo-600">Assistant</span>
          </h1>
          <p className="mt-3 text-lg text-slate-600 max-w-lg mx-auto">
            Your smart shopping and task assistant. It organizes groceries by aisle and to-dos by context.
          </p>
        </header>

        <main className="bg-white p-6 rounded-2xl shadow-xl w-full">
            <InputForm
                userInput={userInput}
                setUserInput={setUserInput}
                onSubmit={handleSubmitInput}
                isLoading={isLoading}
                hasExistingList={checklistData.length > 0}
            />
            {error && (
                <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg animate-fade-in">
                    <strong>Oops:</strong> {error}
                </div>
            )}
        </main>
        
        {isInitializing ? (
          <div className="flex justify-center items-center mt-12">
            <Loader /> 
            <span className="ml-4 text-slate-600">Loading your list...</span>
          </div>
        ) : (
          <Checklist 
            categories={checklistData} 
            onToggleItem={handleToggleItem}
            onMoveItem={handleMoveItem}
            onDeleteItem={requestDeleteItem}
            onDeleteCategory={requestDeleteCategory}
            onEditItem={handleEditItem}
          />
        )}
      </div>
      <ConfirmationModal 
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        onConfirm={modalState.onConfirm!}
        onCancel={closeModal}
      />
    </div>
  );
};

export default App;