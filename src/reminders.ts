function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const BEFORE_DUE = [
  `Hello {name}, Your payment of M{amount} is due on {date}. Kindly arrange payment at your earliest convenience. Thank you.`,
  `Hi {name}, This is a reminder that your payment of M{amount} is due on {date}. Please settle before or on the due date.`,
  `Good day {name}, Your account shows an upcoming payment of M{amount} due on {date}. Kindly prepare payment accordingly.`,
];

const OVERDUE = [
  `Hello {name}, Your payment of M{amount} due on {date} is now overdue. Kindly arrange settlement as soon as possible.`,
  `Hi {name}, This is a reminder that your payment of M{amount} was due on {date} and remains unpaid. Please settle the outstanding balance at your earliest convenience.`,
  `Good day {name}, Your account shows an overdue balance of M{amount} from {date}. Kindly make payment as soon as possible.`,
];

const PAYMENT_REQUEST = [
  `Hello {name}, We are writing to request payment of M{amount} for {summary}. Kindly arrange settlement at your earliest convenience. Thank you.`,
  `Hi {name}, Kindly settle the outstanding payment of M{amount} for {summary}. Your prompt attention to this matter is appreciated.`,
  `Good day {name}, This is a payment request for M{amount} regarding {summary}. We look forward to your settlement. Thank you.`,
];

const INSTALLMENT_REMINDER = [
  `Hello {name}, This is a reminder that installment {current}/{total} of M{amount} for {summary} is due. Please keep up with your payment plan. Thank you.`,
  `Hi {name}, Your installment {current}/{total} of M{amount} for {summary} is now due. Kindly arrange payment to stay on track.`,
  `Good day {name}, A friendly reminder that your next installment ({current}/{total}) of M{amount} for {summary} is due. Please pay at your earliest convenience.`,
];

interface MessageVars {
  name: string;
  amount: string;
  date: string;
  sender: string;
  summary?: string;
  current?: number;
  total?: number;
}

function fill(template: string, vars: MessageVars): string {
  return template
    .replace(/{name}/g, vars.name)
    .replace(/{amount}/g, vars.amount)
    .replace(/{date}/g, vars.date)
    .replace(/{sender}/g, vars.sender)
    .replace(/{summary}/g, vars.summary || '')
    .replace(/{current}/g, String(vars.current || 0))
    .replace(/{total}/g, String(vars.total || 0));
}

export function getReminderMessage(
  type: 'before_due' | 'overdue' | 'payment_request' | 'installment',
  vars: MessageVars
): string {
  let pool: string[];
  switch (type) {
    case 'before_due':
      pool = BEFORE_DUE;
      break;
    case 'overdue':
      pool = OVERDUE;
      break;
    case 'payment_request':
      pool = PAYMENT_REQUEST;
      break;
    case 'installment':
      pool = INSTALLMENT_REMINDER;
      break;
    default:
      pool = PAYMENT_REQUEST;
  }
  return fill(pick(pool), vars);
}

export function getWhatsAppMessage(
  transaction: { totalAmount: number; remainingBalance: number; summaryText: string; dueDate: string; status: string },
  contactName: string,
  activityLabel: string,
  userWhatsApp: string,
  lineItems: { itemDescription: string; itemCost?: number }[],
  installmentInfo?: { current: number; total: number }
): string {
  const fmt = (n: number) => `M ${n.toLocaleString()}`;
  const dueDate = new Date(transaction.dueDate).toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  let msg = `*KTIDEBT - Debt Reminder*\n\n`;
  msg += `*Debtor:* ${contactName}\n`;
  msg += `*Category:* ${activityLabel}\n`;
  msg += `*Summary:* ${transaction.summaryText}\n`;
  msg += `*Total:* ${fmt(transaction.totalAmount)}\n`;
  msg += `*Balance:* ${fmt(transaction.remainingBalance)}\n`;
  msg += `*Due:* ${dueDate}\n`;
  msg += `*Status:* ${transaction.status}\n`;

  if (installmentInfo) {
    msg += `*Installment:* ${installmentInfo.current}/${installmentInfo.total}\n`;
  }

  if (lineItems.length > 0) {
    msg += `\n*Line Items:*\n`;
    lineItems.forEach((item, i) => {
      msg += `${i + 1}. ${item.itemDescription}`;
      if (item.itemCost) msg += ` - ${fmt(item.itemCost)}`;
      msg += `\n`;
    });
  }

  msg += `\nSender: ${userWhatsApp}`;
  msg += `\nPlease arrange payment at your earliest convenience.`;
  return msg;
}
