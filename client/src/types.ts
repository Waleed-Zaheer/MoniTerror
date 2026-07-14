export type Category = 'system' | 'dev' | 'background-app' | 'browser' | 'editor' | 'other';

export interface ProcessInstance {
  pid: number;
  memBytes: number;
  protected: boolean;
}

export interface ProcessGroup {
  name: string;
  totalMemBytes: number;
  protected: boolean;
  category: Category;
  safeToClose: boolean;
  advice: string | null;
  instances: ProcessInstance[];
}

export interface CloseableSummary {
  count: number;
  totalMemBytes: number;
  names: string[];
}

export interface Overview {
  totalMemBytes: number;
  freeMemBytes: number;
  usedMemBytes: number;
  usedPercent: number;
  platform: string;
  platformLabel: string;
  processes: ProcessGroup[];
  closeable: CloseableSummary;
}

export interface PortEntry {
  proto: 'TCP' | 'UDP';
  localAddress: string;
  localPort: number;
  state: string;
  pid: number;
  processName: string;
  protected: boolean;
  category: Category;
  isCommonDevPort: boolean;
}
