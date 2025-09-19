
export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Category {
  category: string;
  items: ChecklistItem[];
}
