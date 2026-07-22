export * from './enums';
export * from './vehicle';

// App.tsx 内の型定義と同一
export type DrivingStatus = 'idle' | 'driving' | 'needs_report';

export type UserProfile = {
  name: string | null;
  email: string;
  uid: string;
};

export type DrivingLog = {
  id: string;
  startTime: any;
  endTime?: any;
  destination?: string;
  purpose?: string;
  status: 'driving' | 'reported';
};
