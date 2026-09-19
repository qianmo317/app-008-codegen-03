import type { MoveTask, Box, PrepItem } from './types';

const DB_NAME = 'MovingBoxTracker';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';

/** 兼容旧数据：补齐准备事项字段 */
function normalize(task: MoveTask): MoveTask {
  if (!Array.isArray(task.prepItems)) task.prepItems = [];
  return task;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
      }
    };
  });
}

export async function getAllTasks(): Promise<MoveTask[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TASKS, 'readonly');
    const store = tx.objectStore(STORE_TASKS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as MoveTask[]).map(normalize));
    req.onerror = () => reject(req.error);
  });
}

export async function getTask(id: string): Promise<MoveTask | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TASKS, 'readonly');
    const store = tx.objectStore(STORE_TASKS);
    const req = store.get(id);
    req.onsuccess = () => {
      const t = req.result as MoveTask | undefined;
      resolve(t ? normalize(t) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveTask(task: MoveTask): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TASKS, 'readwrite');
    const store = tx.objectStore(STORE_TASKS);
    const req = store.put(task);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTask(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_TASKS, 'readwrite');
    const store = tx.objectStore(STORE_TASKS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function addBox(taskId: string, box: Box): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  task.boxes.push(box);
  await saveTask(task);
}

export async function updateBox(taskId: string, box: Box): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  const idx = task.boxes.findIndex((b) => b.id === box.id);
  if (idx === -1) throw new Error('Box not found');
  task.boxes[idx] = box;
  await saveTask(task);
}

export async function deleteBox(taskId: string, boxId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  task.boxes = task.boxes.filter((b) => b.id !== boxId);
  await saveTask(task);
}

export async function addPrepItem(taskId: string, item: PrepItem): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  // 同一条事项不许重复列两次：标题相同且提前天数相同视为重复
  const dup = task.prepItems.some(
    (p) => p.title.trim() === item.title.trim() && p.daysBefore === item.daysBefore,
  );
  if (dup) throw new Error('duplicate');
  task.prepItems.push(item);
  await saveTask(task);
}

export async function updatePrepItem(taskId: string, item: PrepItem): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  const dup = task.prepItems.some(
    (p) =>
      p.id !== item.id &&
      p.title.trim() === item.title.trim() &&
      p.daysBefore === item.daysBefore,
  );
  if (dup) throw new Error('duplicate');
  const idx = task.prepItems.findIndex((p) => p.id === item.id);
  if (idx === -1) throw new Error('Prep item not found');
  task.prepItems[idx] = item;
  await saveTask(task);
}

export async function deletePrepItem(taskId: string, itemId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  task.prepItems = task.prepItems.filter((p) => p.id !== itemId);
  await saveTask(task);
}

/** 勾选/取消勾选；勾选时记下时间，取消时清除 */
export async function togglePrepItem(taskId: string, itemId: string): Promise<void> {
  const task = await getTask(taskId);
  if (!task) throw new Error('Task not found');
  const idx = task.prepItems.findIndex((p) => p.id === itemId);
  if (idx === -1) throw new Error('Prep item not found');
  const it = task.prepItems[idx];
  it.done = !it.done;
  it.doneAt = it.done ? Date.now() : undefined;
  await saveTask(task);
}
