import { Category, ChecklistItem } from '../types';

export const findItemAndCategory = (categories: Category[], itemId: string): { item: ChecklistItem; category: Category } | null => {
    for (const category of categories) {
        const item = category.items.find(i => i.id === itemId);
        if (item) {
            return { item, category };
        }
    }
    return null;
};

export const addItems = (categories: Category[], newItems: string[]): Category[] => {
    const updatedCategories = JSON.parse(JSON.stringify(categories));
    if (newItems.length === 0) return updatedCategories;
    
    // Attempt to add to an "uncategorized" list if it exists, otherwise create one.
    let targetCategory = updatedCategories.find((c: Category) => c.category.toLowerCase() === 'uncategorized');
    if (!targetCategory) {
        targetCategory = { category: 'Uncategorized', items: [] };
        updatedCategories.push(targetCategory);
    }
    
    newItems.forEach(itemText => {
        targetCategory!.items.push({
            id: crypto.randomUUID(),
            text: itemText,
            completed: false,
        });
    });

    return updatedCategories;
};


export const removeItems = (categories: Category[], itemsToRemove: string[]): Category[] => {
    if (itemsToRemove.length === 0) return categories;
    
    const lowercasedItemsToRemove = itemsToRemove.map(item => item.toLowerCase().trim());
    
    return categories.map(category => ({
        ...category,
        items: category.items.filter(item => 
            !lowercasedItemsToRemove.includes(item.text.toLowerCase().trim())
        ),
    })).filter(category => category.items.length > 0);
};


export const toggleItem = (categories: Category[], categoryId: string, itemId: string): Category[] => {
    return categories.map(category => {
        if (category.category === categoryId) {
            return {
                ...category,
                items: category.items.map(item =>
                    item.id === itemId ? { ...item, completed: !item.completed } : item
                ),
            };
        }
        return category;
    });
};

export const moveItem = (categories: Category[], itemId: string, sourceCategoryId: string, destCategoryId: string): Category[] => {
    if (sourceCategoryId === destCategoryId) return categories;

    const sourceCategory = categories.find(c => c.category === sourceCategoryId);
    const destCategory = categories.find(c => c.category === destCategoryId);
    const itemToMove = sourceCategory?.items.find(i => i.id === itemId);

    if (!sourceCategory || !destCategory || !itemToMove) return categories;

    let updatedCategories = categories.map(category => {
        if (category.category === sourceCategoryId) {
            return { ...category, items: category.items.filter(i => i.id !== itemId) };
        }
        if (category.category === destCategoryId) {
            return { ...category, items: [...category.items, itemToMove] };
        }
        return category;
    });
    
    // Remove empty source category
    updatedCategories = updatedCategories.filter(c => c.items.length > 0);

    return updatedCategories;
};

export const deleteItem = (categories: Category[], categoryId: string, itemId: string): Category[] => {
    return categories
        .map(category => {
            if (category.category === categoryId) {
                return {
                    ...category,
                    items: category.items.filter(item => item.id !== itemId),
                };
            }
            return category;
        })
        .filter(category => category.items.length > 0); // Remove category if it becomes empty
};

export const deleteCategory = (categories: Category[], categoryId: string): Category[] => {
    return categories.filter(category => category.category !== categoryId);
};

export const editItem = (categories: Category[], categoryId: string, itemId: string, newText: string): Category[] => {
    return categories.map(category => {
        if (category.category === categoryId) {
            return {
                ...category,
                items: category.items.map(item =>
                    item.id === itemId ? { ...item, text: newText } : item
                ),
            };
        }
        return category;
    });
};

export const mergeCategories = (existingCategories: Category[], newCategories: Category[]): Category[] => {
    if (existingCategories.length === 0) {
        return newCategories;
    }
    
    const updatedCategories = JSON.parse(JSON.stringify(existingCategories));

    newCategories.forEach(newCategory => {
        const existingCategoryIndex = updatedCategories.findIndex(
            (c: Category) => c.category.toLowerCase().trim() === newCategory.category.toLowerCase().trim()
        );

        if (existingCategoryIndex > -1) {
            const existingCategory = updatedCategories[existingCategoryIndex];
            const existingItemTexts = new Set(existingCategory.items.map((item: ChecklistItem) => item.text.toLowerCase().trim()));
            
            newCategory.items.forEach(newItem => {
                if (!existingItemTexts.has(newItem.text.toLowerCase().trim())) {
                    existingCategory.items.push(newItem);
                }
            });
        } else {
            updatedCategories.push(newCategory);
        }
    });

    return updatedCategories;
};