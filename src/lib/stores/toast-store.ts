import { create } from "zustand";

export interface Toast {
  id: number;
  message: string;
  variant: "error" | "info";
}

interface ToastState {
  toasts: Toast[];
  nextId: number;
  push: (message: string, variant?: Toast["variant"]) => void;
  dismiss: (id: number) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  nextId: 1,
  push: (message, variant = "error") => {
    const id = get().nextId;
    set({ toasts: [...get().toasts, { id, message, variant }], nextId: id + 1 });
    setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
