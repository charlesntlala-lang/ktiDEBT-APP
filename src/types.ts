export type DebtStatus = 'PAID' | 'GRACE' | 'OVERDUE' | 'BAD_DEBT';

export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsappLink: string;
}

export interface Activity {
  id: string;
  type: string;
  icon: string;
}

export interface InstallmentPlan {
  totalInstallments: number;
  paidInstallments: number;
  installmentAmount: number;
  frequency: InstallmentFrequency;
  startDate: string;
}

export interface DebtTransaction {
  id: string;
  contactId: string;
  activityId: string;
  summaryText: string;
  totalAmount: number;
  remainingBalance: number;
  dateRecorded: string;
  dueDate: string;
  status: DebtStatus;
  installmentPlan?: InstallmentPlan;
  writeOffReason?: string;
  writeOffDate?: string;
  archived: boolean;
  paidDate?: string;
}

export interface DebtLineItem {
  id: string;
  transactionId: string;
  itemDescription: string;
  itemCost?: number;
}
