
export interface Participant {
  id: string;
  name: string;
  pixKey?: string;
}

export interface Expense {
  id: string;
  participantId: string;
  amount: number;
  description: string;
  date: number;
}

export interface AppState {
  eventName: string;
  participants: Participant[];
  expenses: Expense[];
}
