export type BoxStatus = 'packed' | 'loaded' | 'arrived' | 'unpacked' | 'damaged' | 'missing';

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

export type PrepItem = {
  id: string;
  title: string;
  offsetDays: number; // 提前几天办，0 = 搬家当天
  contact: string; // 找谁办
  duration: string; // 大概多久
  done: boolean;
  doneAt?: number;
  createdAt: number;
};

export type MoveTask = {
  id: string;
  title: string;
  from: string;
  to: string;
  date: string;
  rooms: string[];
  boxes: Box[];
  prepItems?: PrepItem[];
  createdAt: number;
};
