import React, { createContext, useContext, useReducer, useCallback, ReactNode, useEffect, useRef, useState } from 'react';
import { Contact, Activity, DebtTransaction, DebtLineItem, DebtStatus, InstallmentPlan, InstallmentFrequency } from './types';
import { generateId } from './data';
import { saveState, loadState } from './persistence';

export interface AppState {
  contacts: Contact[];
  activities: Activity[];
  transactions: DebtTransaction[];
  lineItems: DebtLineItem[];
  userWhatsApp: string;
  onboardingComplete: boolean;
  authEnabled: boolean;
  authPin: string;
}

type Action =
  | { type: 'LOAD_STATE'; payload: AppState }
  | { type: 'ADD_TRANSACTION'; payload: { transaction: DebtTransaction; lineItems: DebtLineItem[] } }
  | { type: 'UPDATE_TRANSACTION'; payload: DebtTransaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'MAKE_PAYMENT'; payload: { transactionId: string; amount: number } }
  | { type: 'MARK_BAD_DEBT'; payload: { transactionId: string; reason: string; writeOffDate: string } }
  | { type: 'ARCHIVE_DEBT'; payload: string }
  | { type: 'SET_INSTALLMENT_PLAN'; payload: { transactionId: string; plan: InstallmentPlan } }
  | { type: 'PAY_INSTALLMENT'; payload: string }
  | { type: 'ADD_ACTIVITY'; payload: Activity }
  | { type: 'UPDATE_ACTIVITY'; payload: Activity }
  | { type: 'DELETE_ACTIVITY'; payload: string }
  | { type: 'ADD_CONTACT'; payload: Contact }
  | { type: 'UPDATE_CONTACT'; payload: Contact }
  | { type: 'SET_USER_WHATSAPP'; payload: string }
  | { type: 'SET_ONBOARDING_COMPLETE'; payload: boolean }
  | { type: 'SET_AUTH_ENABLED'; payload: boolean }
  | { type: 'SET_AUTH_PIN'; payload: string }
  | { type: 'PURGE_OLD_PAID' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_STATE':
      return action.payload;

    case 'ADD_TRANSACTION': {
      const { transaction, lineItems } = action.payload;
      return {
        ...state,
        transactions: [transaction, ...state.transactions],
        lineItems: [...state.lineItems, ...lineItems],
      };
    }
    case 'UPDATE_TRANSACTION': {
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload.id ? action.payload : t
        ),
      };
    }
    case 'DELETE_TRANSACTION': {
      return {
        ...state,
        transactions: state.transactions.filter((t) => t.id !== action.payload),
        lineItems: state.lineItems.filter((li) => li.transactionId !== action.payload),
      };
    }
    case 'MAKE_PAYMENT': {
      const { transactionId, amount } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((t) => {
          if (t.id !== transactionId) return t;
          const newBalance = Math.max(0, t.remainingBalance - amount);
          const newStatus: DebtStatus = newBalance === 0 ? 'PAID' : t.status;
          return {
            ...t,
            remainingBalance: newBalance,
            status: newStatus,
            paidDate: newStatus === 'PAID' ? new Date().toISOString() : t.paidDate,
          };
        }),
      };
    }
    case 'MARK_BAD_DEBT': {
      const { transactionId, reason, writeOffDate } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === transactionId
            ? { ...t, status: 'BAD_DEBT' as DebtStatus, writeOffReason: reason, writeOffDate }
            : t
        ),
      };
    }
    case 'ARCHIVE_DEBT': {
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === action.payload ? { ...t, archived: true } : t
        ),
      };
    }
    case 'SET_INSTALLMENT_PLAN': {
      const { transactionId, plan } = action.payload;
      return {
        ...state,
        transactions: state.transactions.map((t) =>
          t.id === transactionId ? { ...t, installmentPlan: plan } : t
        ),
      };
    }
    case 'PAY_INSTALLMENT': {
      return {
        ...state,
        transactions: state.transactions.map((t) => {
          if (t.id !== action.payload || !t.installmentPlan) return t;
          const plan = t.installmentPlan;
          const newPaid = plan.paidInstallments + 1;
          const newBalance = Math.max(0, t.remainingBalance - plan.installmentAmount);
          const isComplete = newPaid >= plan.totalInstallments;
          const newStatus: DebtStatus = isComplete ? 'PAID' : t.status;
          return {
            ...t,
            remainingBalance: newBalance,
            status: newStatus,
            paidDate: newStatus === 'PAID' ? new Date().toISOString() : t.paidDate,
            installmentPlan: { ...plan, paidInstallments: newPaid },
          };
        }),
      };
    }
    case 'ADD_ACTIVITY': {
      if (state.activities.some((a) => a.type.toLowerCase() === action.payload.type.toLowerCase())) return state;
      return { ...state, activities: [...state.activities, action.payload] };
    }
    case 'UPDATE_ACTIVITY': {
      return {
        ...state,
        activities: state.activities.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    }
    case 'DELETE_ACTIVITY': {
      return {
        ...state,
        activities: state.activities.filter((a) => a.id !== action.payload),
      };
    }
    case 'ADD_CONTACT': {
      if (state.contacts.some((c) => c.name.toLowerCase() === action.payload.name.toLowerCase())) return state;
      return { ...state, contacts: [...state.contacts, action.payload] };
    }
    case 'UPDATE_CONTACT': {
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    }
    case 'SET_USER_WHATSAPP': {
      return { ...state, userWhatsApp: action.payload };
    }
    case 'SET_ONBOARDING_COMPLETE': {
      return { ...state, onboardingComplete: action.payload };
    }
    case 'SET_AUTH_ENABLED': {
      return { ...state, authEnabled: action.payload };
    }
    case 'SET_AUTH_PIN': {
      return { ...state, authPin: action.payload };
    }
    case 'PURGE_OLD_PAID': {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 25);
      const cutoffMs = cutoff.getTime();
      const keep: DebtTransaction[] = [];
      const removeIds: string[] = [];
      for (const t of state.transactions) {
        if (t.status === 'PAID' && t.paidDate) {
          const paidMs = new Date(t.paidDate).getTime();
          if (paidMs < cutoffMs) {
            removeIds.push(t.id);
            continue;
          }
        }
        keep.push(t);
      }
      if (removeIds.length === 0) return state;
      return {
        ...state,
        transactions: keep,
        lineItems: state.lineItems.filter((li) => !removeIds.includes(li.transactionId)),
      };
    }
    default:
      return state;
  }
}

const initialState: AppState = {
  contacts: [],
  activities: [],
  transactions: [],
  lineItems: [],
  userWhatsApp: '+26669256516',
  onboardingComplete: false,
  authEnabled: true,
  authPin: '',
};

interface AppContextType {
  state: AppState;
  restored: boolean;
  addTransaction: (transaction: Omit<DebtTransaction, 'id' | 'archived'>, lineItems: Omit<DebtLineItem, 'id' | 'transactionId'>[]) => void;
  updateTransaction: (transaction: DebtTransaction) => void;
  deleteTransaction: (id: string) => void;
  makePayment: (transactionId: string, amount: number) => void;
  markBadDebt: (transactionId: string, reason: string) => void;
  archiveDebt: (transactionId: string) => void;
  setInstallmentPlan: (transactionId: string, plan: InstallmentPlan) => void;
  payInstallment: (transactionId: string) => void;
  addActivity: (activity: Activity) => void;
  updateActivity: (activity: Activity) => void;
  deleteActivity: (id: string) => void;
  addContact: (contact: Omit<Contact, 'id'>) => void;
  updateContact: (contact: Contact) => void;
  setUserWhatsApp: (number: string) => void;
  setOnboardingComplete: (v: boolean) => void;
  setAuthEnabled: (v: boolean) => void;
  setAuthPin: (pin: string) => void;
  getContact: (id: string) => Contact | undefined;
  getActivity: (id: string) => Activity | undefined;
  getLineItems: (transactionId: string) => DebtLineItem[];
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [restored, setRestored] = useState(false);
  const loaded = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    loadState().then((saved) => {
      if (saved) {
        dispatch({ type: 'LOAD_STATE', payload: saved });
      }
      dispatch({ type: 'PURGE_OLD_PAID' });
      setRestored(true);
    });
  }, []);

  const purgeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!restored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveState(state);
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, restored]);

  useEffect(() => {
    if (!restored) return;
    if (purgeTimer.current) clearTimeout(purgeTimer.current);
    purgeTimer.current = setTimeout(() => {
      dispatch({ type: 'PURGE_OLD_PAID' });
    }, 1000);
    return () => {
      if (purgeTimer.current) clearTimeout(purgeTimer.current);
    };
  }, [state.transactions, restored]);

  const addTransaction = useCallback(
    (transaction: Omit<DebtTransaction, 'id' | 'archived'>, items: Omit<DebtLineItem, 'id' | 'transactionId'>[]) => {
      const tId = generateId();
      const newTransaction: DebtTransaction = { ...transaction, id: tId, archived: false };
      const newLineItems: DebtLineItem[] = items.map((item) => ({
        ...item,
        id: generateId(),
        transactionId: tId,
      }));
      dispatch({ type: 'ADD_TRANSACTION', payload: { transaction: newTransaction, lineItems: newLineItems } });
    },
    []
  );

  const updateTransaction = useCallback((transaction: DebtTransaction) => {
    dispatch({ type: 'UPDATE_TRANSACTION', payload: transaction });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: 'DELETE_TRANSACTION', payload: id });
  }, []);

  const makePayment = useCallback((transactionId: string, amount: number) => {
    dispatch({ type: 'MAKE_PAYMENT', payload: { transactionId, amount } });
  }, []);

  const markBadDebt = useCallback((transactionId: string, reason: string) => {
    const writeOffDate = new Date().toISOString().split('T')[0];
    dispatch({ type: 'MARK_BAD_DEBT', payload: { transactionId, reason, writeOffDate } });
  }, []);

  const archiveDebt = useCallback((transactionId: string) => {
    dispatch({ type: 'ARCHIVE_DEBT', payload: transactionId });
  }, []);

  const setInstallmentPlan = useCallback((transactionId: string, plan: InstallmentPlan) => {
    dispatch({ type: 'SET_INSTALLMENT_PLAN', payload: { transactionId, plan } });
  }, []);

  const payInstallment = useCallback((transactionId: string) => {
    dispatch({ type: 'PAY_INSTALLMENT', payload: transactionId });
  }, []);

  const addActivity = useCallback((activity: Activity) => {
    dispatch({ type: 'ADD_ACTIVITY', payload: activity });
  }, []);

  const updateActivity = useCallback((activity: Activity) => {
    dispatch({ type: 'UPDATE_ACTIVITY', payload: activity });
  }, []);

  const deleteActivity = useCallback((id: string) => {
    dispatch({ type: 'DELETE_ACTIVITY', payload: id });
  }, []);

  const addContact = useCallback((contact: Omit<Contact, 'id'>) => {
    dispatch({ type: 'ADD_CONTACT', payload: { ...contact, id: `c_${Date.now()}` } });
  }, []);

  const updateContact = useCallback((contact: Contact) => {
    dispatch({ type: 'UPDATE_CONTACT', payload: contact });
  }, []);

  const setUserWhatsApp = useCallback((number: string) => {
    dispatch({ type: 'SET_USER_WHATSAPP', payload: number });
  }, []);

  const setOnboardingComplete = useCallback((v: boolean) => {
    dispatch({ type: 'SET_ONBOARDING_COMPLETE', payload: v });
  }, []);

  const setAuthEnabled = useCallback((v: boolean) => {
    dispatch({ type: 'SET_AUTH_ENABLED', payload: v });
  }, []);

  const setAuthPin = useCallback((pin: string) => {
    dispatch({ type: 'SET_AUTH_PIN', payload: pin });
  }, []);

  const getContact = useCallback(
    (id: string) => state.contacts.find((c) => c.id === id),
    [state.contacts]
  );

  const getActivity = useCallback(
    (id: string) => state.activities.find((a) => a.id === id),
    [state.activities]
  );

  const getLineItems = useCallback(
    (transactionId: string) => state.lineItems.filter((li) => li.transactionId === transactionId),
    [state.lineItems]
  );

  return (
    <AppContext.Provider
      value={{
        state, restored, addTransaction, updateTransaction, deleteTransaction,
        makePayment, markBadDebt, archiveDebt, setInstallmentPlan, payInstallment,
        addActivity, updateActivity, deleteActivity,
        addContact, updateContact, setUserWhatsApp,
        setOnboardingComplete, setAuthEnabled, setAuthPin,
        getContact, getActivity, getLineItems,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
