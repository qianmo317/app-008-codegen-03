<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  getTask,
  saveTask,
  addPrepItem,
  updatePrepItem,
  deletePrepItem,
  togglePrepItem,
} from '../db';
import { uid, dateBefore, daysUntil, todayStr, dateStr } from '../utils';
import type { MoveTask, PrepItem } from '../types';

const route = useRoute();
const taskId = route.params.id as string;
const task = ref<MoveTask | null>(null);

const showForm = ref(false);
const editingId = ref<string | null>(null);
const fTitle = ref('');
const fDays = ref(7);
const fContact = ref('');
const fDuration = ref('');

const countdown = computed(() => (task.value ? daysUntil(task.value.date) : 0));
const doneCount = computed(
  () => task.value?.prepItems.filter((p) => p.done).length ?? 0,
);

/** 搬家当天的事项单独成组，只在这里出现，不在下方列表重复 */
const movingDayItems = computed(() =>
  (task.value?.prepItems ?? [])
    .filter((p) => p.daysBefore === 0)
    .sort((a, b) => a.createdAt - b.createdAt),
);

/** 其余事项按"提前天数"分组，天数大的在前（先办的在前） */
const groups = computed(() => {
  const map = new Map<number, PrepItem[]>();
  for (const p of task.value?.prepItems ?? []) {
    if (p.daysBefore === 0) continue;
    if (!map.has(p.daysBefore)) map.set(p.daysBefore, []);
    map.get(p.daysBefore)!.push(p);
  }
  return [...map.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([days, items]) => ({
      days,
      date: dateBefore(task.value!.date, days),
      items: items.sort((a, b) => a.createdAt - b.createdAt),
    }));
});

function isOverdue(p: PrepItem): boolean {
  if (p.done || !task.value) return false;
  return dateBefore(task.value.date, p.daysBefore) < todayStr();
}

function fmtDoneAt(ts: number): string {
  const d = new Date(ts);
  return `${dateStr(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function resetForm() {
  fTitle.value = '';
  fDays.value = 7;
  fContact.value = '';
  fDuration.value = '';
  editingId.value = null;
  showForm.value = false;
}

function startEdit(p: PrepItem) {
  editingId.value = p.id;
  fTitle.value = p.title;
  fDays.value = p.daysBefore;
  fContact.value = p.contact;
  fDuration.value = p.duration;
  showForm.value = true;
  window.scrollTo({ top: 0 });
}

async function submitForm() {
  if (!fTitle.value.trim() || !fContact.value.trim() || !fDuration.value.trim()) {
    alert('请填写事项、找谁办、大概多久');
    return;
  }
  if (fDays.value < 0 || !Number.isInteger(fDays.value)) {
    alert('提前天数必须是不小于 0 的整数');
    return;
  }
  try {
    if (editingId.value) {
      const old = task.value!.prepItems.find((p) => p.id === editingId.value)!;
      await updatePrepItem(taskId, {
        ...old,
        title: fTitle.value.trim(),
        daysBefore: fDays.value,
        contact: fContact.value.trim(),
        duration: fDuration.value.trim(),
      });
    } else {
      await addPrepItem(taskId, {
        id: uid(),
        title: fTitle.value.trim(),
        daysBefore: fDays.value,
        contact: fContact.value.trim(),
        duration: fDuration.value.trim(),
        done: false,
        createdAt: Date.now(),
      });
    }
  } catch (e) {
    if (e instanceof Error && e.message === 'duplicate') {
      alert('同一条事项已经列过了（事项内容和提前天数都相同）');
      return;
    }
    throw e;
  }
  resetForm();
  await reload();
}

async function reload() {
  task.value = await getTask(taskId);
}

async function changeDate(e: Event) {
  if (!task.value) return;
  const val = (e.target as HTMLInputElement).value;
  task.value.date = val;
  await saveTask(task.value);
  await reload();
}

async function toggle(p: PrepItem) {
  await togglePrepItem(taskId, p.id);
  await reload();
}

async function remove(p: PrepItem) {
  if (!confirm(`删除事项「${p.title}」？`)) return;
  await deletePrepItem(taskId, p.id);
  if (editingId.value === p.id) resetForm();
  await reload();
}

onMounted(reload);
</script>

<template>
  <div v-if="task">
    <div class="header">
      <router-link :to="`/task/${task.id}`" class="back">←</router-link>
      <h1>倒排准备事项</h1>
    </div>
    <div class="page">
      <!-- 搬家日：一改日期，下面所有计划日期跟着重排 -->
      <div class="card date-card">
        <label class="label">搬家日子（改日期，整份清单自动重排）</label>
        <input type="date" class="input" :value="task.date" @change="changeDate" />
        <div class="countdown">
          <template v-if="countdown > 0">距搬家还有 <b>{{ countdown }}</b> 天</template>
          <template v-else-if="countdown === 0"><b>今天就是搬家日</b></template>
          <template v-else>搬家日已过 {{ -countdown }} 天</template>
          <span class="progress-text">已办完 {{ doneCount }}/{{ task.prepItems.length }}</span>
        </div>
      </div>

      <!-- 搬家当天撞在一起的事，单独标出来 -->
      <div class="card moving-day-card">
        <div class="moving-day-title">🚚 搬家当天（{{ task.date }}）· {{ movingDayItems.length }} 件事挤在一起</div>
        <div v-if="movingDayItems.length === 0" class="empty" style="padding:8px 0;">还没有安排在当天的事项</div>
        <div v-for="p in movingDayItems" :key="p.id" class="prep-row" :class="{ done: p.done }">
          <label class="check">
            <input type="checkbox" :checked="p.done" @change="toggle(p)" />
            <span>{{ p.title }}</span>
          </label>
          <div class="meta">
            找：{{ p.contact }} · 约需 {{ p.duration }}
            <template v-if="p.done && p.doneAt"> · 已于 {{ fmtDoneAt(p.doneAt) }} 办完</template>
          </div>
          <div class="row-actions no-print">
            <button class="link-btn" @click="startEdit(p)">编辑</button>
            <button class="link-btn danger" @click="remove(p)">删除</button>
          </div>
        </div>
      </div>

      <button v-if="!showForm" class="btn btn-block" @click="showForm = true">+ 添加准备事项</button>

      <div v-if="showForm" class="card">
        <div style="font-weight:700;margin-bottom:10px;">{{ editingId ? '编辑事项' : '新事项' }}</div>
        <label class="label">事项内容</label>
        <input v-model="fTitle" class="input" placeholder="例如：联系物业开出门条" />
        <label class="label" style="margin-top:10px;">提前几天办（0 = 搬家当天）</label>
        <input v-model.number="fDays" type="number" min="0" step="1" class="input" />
        <label class="label" style="margin-top:10px;">找谁办</label>
        <input v-model="fContact" class="input" placeholder="例如：物业前台 / 搬家公司 / 自己" />
        <label class="label" style="margin-top:10px;">大概多久</label>
        <input v-model="fDuration" class="input" placeholder="例如：20分钟 / 半天" />
        <div class="toolbar" style="grid-template-columns:1fr 1fr;">
          <button class="btn btn-secondary" @click="resetForm">取消</button>
          <button class="btn btn-success" @click="submitForm">{{ editingId ? '保存' : '添加' }}</button>
        </div>
      </div>

      <!-- 倒排分组：最早该办的在前 -->
      <div v-for="g in groups" :key="g.days" class="card">
        <div class="group-title">
          提前 {{ g.days }} 天 · {{ g.date }}
          <span v-if="g.date < todayStr() && g.items.some((p) => !p.done)" class="overdue-flag">已有逾期</span>
        </div>
        <div v-for="p in g.items" :key="p.id" class="prep-row" :class="{ done: p.done }">
          <label class="check">
            <input type="checkbox" :checked="p.done" @change="toggle(p)" />
            <span>{{ p.title }}</span>
          </label>
          <div class="meta">
            找：{{ p.contact }} · 约需 {{ p.duration }}
            <span v-if="isOverdue(p)" class="overdue-flag">该办了，已过计划日</span>
            <template v-if="p.done && p.doneAt"> · 已于 {{ fmtDoneAt(p.doneAt) }} 办完</template>
          </div>
          <div class="row-actions no-print">
            <button class="link-btn" @click="startEdit(p)">编辑</button>
            <button class="link-btn danger" @click="remove(p)">删除</button>
          </div>
        </div>
      </div>

      <div v-if="task.prepItems.length === 0" class="empty">还没有准备事项，点上方按钮添加</div>
    </div>
  </div>
</template>

<style scoped>
.date-card {
  border-color: var(--primary);
}
.countdown {
  margin-top: 10px;
  font-size: 14px;
  color: var(--text-secondary);
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
}
.countdown b {
  color: var(--primary-dark);
  font-size: 16px;
}
.progress-text {
  color: var(--success);
  font-weight: 600;
}
.moving-day-card {
  border: 2px solid var(--danger);
  background: color-mix(in srgb, var(--danger) 8%, var(--surface));
}
.moving-day-title {
  font-weight: 800;
  color: var(--danger);
  margin-bottom: 10px;
}
.group-title {
  font-weight: 700;
  margin-bottom: 10px;
  font-size: 15px;
}
.prep-row {
  padding: 10px 0;
  border-top: 1px dashed var(--border);
}
.prep-row:first-of-type {
  border-top: none;
  padding-top: 0;
}
.check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 15px;
  cursor: pointer;
}
.check input {
  width: 20px;
  height: 20px;
  margin-top: 1px;
  accent-color: var(--success);
  flex-shrink: 0;
}
.done .check span {
  text-decoration: line-through;
  color: var(--text-secondary);
}
.meta {
  margin: 4px 0 0 30px;
  font-size: 13px;
  color: var(--text-secondary);
}
.row-actions {
  margin: 4px 0 0 30px;
  display: flex;
  gap: 14px;
}
.link-btn {
  border: none;
  background: none;
  padding: 0;
  font-size: 13px;
  color: var(--info);
  cursor: pointer;
}
.link-btn.danger {
  color: var(--danger);
}
.overdue-flag {
  color: #fff;
  background: var(--danger);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 12px;
  margin-left: 6px;
}
</style>
