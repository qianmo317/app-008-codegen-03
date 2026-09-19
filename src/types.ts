export type BoxStatus = 'packed' | 'loaded' | 'arrived' | 'unpacked' | 'damaged' | 'missing';

export type PrepItem = {
  id: string;
  title: string; // 事项内容
  daysBefore: number; // 提前几天办（0 = 搬家当天）
  contact: string; // 找谁办
  duration: string; // 大概多久，如 30分钟 / 半天
  done: boolean;
  doneAt?: number; // 办完时间戳
  createdAt: number;
};

export type Box = {
  id: string;
  code: string; // e.g. A-014
  roomFrom: string;
  roomTo: string;
  tags: string[];
  fragile: boolean;
  liquid: boolean;
  photo?: string; // compressed dataURL
  weightKg?: number;
  status: BoxStatus;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type MoveTask = {
  id: string;
  title: string;
  from: string;
  to: string;
  date: string;
  rooms: string[];
  boxes: Box[];
  prepItems: PrepItem[];
  createdAt: number;
};
