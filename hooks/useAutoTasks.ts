import { useEffect } from 'react';
import { Transaction, RecurringItem } from '../types';
import * as storage from '../services/storage';

interface UseAutoTasksProps {
  transactions: Transaction[];
  recurring: RecurringItem[];
  recurringExecuted: Record<string, string[]>;
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setRecurringExecuted: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  setToast: (toast: { message: string; count: number } | null) => void;
}

export const useAutoTasks = ({
  transactions,
  recurring,
  recurringExecuted,
  setTransactions,
  setRecurringExecuted,
  setToast,
}: UseAutoTasksProps) => {
  useEffect(() => {
    if (recurring.length === 0) {
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    let newTransactions: Transaction[] = [];
    let executedCount = 0;
    
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();
    const currentMonthKey = today.toISOString().substring(0, 7);
    let newLog = { ...recurringExecuted };

    recurring.forEach(item => {
        const itemLogs = newLog[item.id] || [];
        if (itemLogs.includes(currentMonthKey)) return;

        let shouldExecute = false;
        let targetDate = '';

        if (item.frequency === 'MONTHLY') {
            if (currentDay >= item.dayOfMonth) {
                shouldExecute = true;
                targetDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(item.dayOfMonth).padStart(2, '0')}`;
            }
        } else if (item.frequency === 'YEARLY') {
            const targetMonth = item.monthOfYear || 1;
            if (currentMonth > targetMonth || (currentMonth === targetMonth && currentDay >= item.dayOfMonth)) {
                 shouldExecute = true;
                 targetDate = `${currentYear}-${String(targetMonth).padStart(2, '0')}-${String(item.dayOfMonth).padStart(2, '0')}`;
            }
        }

        if (shouldExecute) {
            newTransactions.push({
                id: crypto.randomUUID(),
                date: targetDate, 
                amount: item.amount,
                category: item.category,
                item: `[固定] ${item.name}`,
                type: item.type,
                note: '系統自動入帳 (Auto-Executed)',
                source: 'MANUAL' 
            });
            if (!newLog[item.id]) newLog[item.id] = [];
            newLog[item.id].push(currentMonthKey);
            executedCount++;
        }
    });

    if (executedCount > 0) {
        setRecurringExecuted(newLog);
        storage.saveRecurringExecuted(newLog);
    }
    
    if (newTransactions.length > 0) {
        const updatedTransactions = [...transactions, ...newTransactions];
        setTransactions(updatedTransactions);
        storage.saveTransactions(updatedTransactions);
        
        setToast({ message: `系統自動補入 ${executedCount} 筆固定帳務`, count: executedCount });
        setTimeout(() => setToast(null), 5000);
    }
  }, [recurring, recurringExecuted, transactions, setRecurringExecuted, setTransactions, setToast]);
};
