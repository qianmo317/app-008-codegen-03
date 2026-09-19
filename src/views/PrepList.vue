<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { getTask, saveTask, addPrepItem, updatePrepItem, deletePrepItem } from '../db';
import { uid, addDays, weekdayLabel, formatDateTime } from '../utils';
import type { MoveTask, PrepItem } from '../types';

const route = useRoute();
const task = ref<MoveTask | null>(null);

const title = ref('');
const offsetDays = ref(7);
const contact = ref('');
const duration = ref('');

const items = computed(() => task.value?.prepItems ?? []);

// 按办理日期正序排（最早要办的在前），同一天的按创建顺序
const sortedItems = computed(() =>
  [...items.value].sort((a, b) => b.offsetDays - a.offsetDays || a.createdAt - b.createdAt),
);

// 跟搬家当天撞在一起的事，单独标出来
const sameDayItems = computed(() => sortedItems.value.filter((p) => p.offsetDays === 0));
const aheadItems = computed(() => sortedItems.value.filter((p) => p.offsetDays > 0));

const doneCount = computed(() => items.value.filter((p) => p.done).length);

function scheduledDate(item: PrepItem): string {
  if (!task.value) return '';
  return addDays(task.value.date, -item.offsetDays);
}

async function load() {
  task.value = await getTask(route.params.id as string);
}

// 搬家日期一改，整份清单跟着重排（办理日期都由 date 倒推）
async function onDateChange() {
  if (!task.value) return;
  await saveTask(task.value);
}

async function add() {
  if (!task.value) return;
  const name = title.value.trim();
  if (!name) {
    alert('请填写事项名称');
    return;
  }
  // 同一条事项不许重复列两次
  if (items.value.some((p) => p.title.trim() === name)) {
    alert(`「${name}」已经在清单里了，不能重复添加`);
    return;
  }
  const item: PrepItem = {
    id: uid(),
    title: name,
    offsetDays: Math.max(0, Math.floor(Number(offsetDays.value) || 0)),
    contact: contact.value.trim(),
    duration: duration.value.trim(),
    done: false,
    createdAt: Date.now(),
  };
  await addPrepItem(task.value.id, item);
  title.value = '';
  contact.value = '';
  duration.value = '';
  await load();
}

async function toggleDone(item: PrepItem) {
  if (!task.value) return;
  const done = !item.done;
  await updatePrepItem(task.value.id, {
    ...item,
    done,
    doneAt: done ? Date.now() : undefined,
  });
  await load();
}

async function remove(item: PrepItem) {
  if (!task.value) return;
  if (!confirm(`确定删除「${item.title}」？`)) return;
  await deletePrepItem(task.value.id, item.id);
  await load();
}

onMounted(load);
</script>

<template>
  <div v-if="task">
    <div class="header">
      <router-link :to="`/task/${task.id}`" class="back">←</router-link>
      <h1>搬家准备清单</h1>
    </div>
    <div class="page">
      <div class="card">
        <label class="label">搬家日期（改日期后整份清单自动重排）</label>
        <input v-model="task.date" type="date" class="input" @change="onDateChange" />
        <div style="font-size:13px;color:var(--text-secondary);margin-top:8px;">
          共 {{ items.length }} 项，已完成 {{ doneCount }} 项
        </div>
      </div>

      <div class="card">
        <div style="font-weight:700;margin-bottom:8px;">添加准备事项</div>
        <label class="label">事项名称</label>
        <input v-model="title" class="input" placeholder="例如：联系物业开出门条" />
        <div class="grid-2" style="margin-top:10px;">
          <div>
            <label class="label">提前几天办</label>
            <input v-model="offsetDays" type="number" min="0" class="input" />
          </div>
          <div>
            <label class="label">找谁办</label>
            <input v-model="contact" class="input" placeholder="例如：物业前台" />
          </div>
        </div>
        <div style="margin-top:10px;">
          <label class="label">大概多久</label>
          <input v-model="duration" class="input" placeholder="例如：10分钟 / 半天" />
        </div>
        <button class="btn btn-block" style="margin-top:12px;" @click="add">添加到清单</button>
      </div>

      <div v-if="sameDayItems.length > 0" class="same-day">
        <div style="font-weight:700;color:var(--danger);margin-bottom:8px;">
          ⚠️ 搬家当天要办（{{ task.date }} {{ weekdayLabel(task.date) }}）
        </div>
        <div v-for="item in sameDayItems" :key="item.id" class="card prep-card same-day-card">
          <div class="prep-row" @click="toggleDone(item)">
            <span class="checkbox" :class="{ checked: item.done }">{{ item.done ? '✓' : '' }}</span>
            <div style="flex:1;">
              <div class="prep-title" :class="{ done: item.done }">{{ item.title }}</div>
              <div class="prep-meta">
                <span v-if="item.contact">找 {{ item.contact }}</span>
                <span v-if="item.duration"> · 约 {{ item.duration }}</span>
              </div>
              <div v-if="item.done && item.doneAt" class="done-at">已于 {{ formatDateTime(item.doneAt) }} 办完</div>
            </div>
            <button class="btn btn-secondary del-btn" @click.stop="remove(item)">删除</button>
          </div>
        </div>
      </div>

      <div v-if="aheadItems.length > 0" style="font-weight:700;margin:12px 0 8px;">提前办理</div>
      <div v-for="item in aheadItems" :key="item.id" class="card prep-card">
        <div class="prep-row" @click="toggleDone(item)">
          <span class="checkbox" :class="{ checked: item.done }">{{ item.done ? '✓' : '' }}</span>
          <div style="flex:1;">
            <div class="prep-title" :class="{ done: item.done }">{{ item.title }}</div>
            <div class="prep-meta">
              {{ scheduledDate(item) }} {{ weekdayLabel(scheduledDate(item)) }} · 提前{{ item.offsetDays }}天<span v-if="item.contact"> · 找 {{ item.contact }}</span><span v-if="item.duration"> · 约 {{ item.duration }}</span>
            </div>
            <div v-if="item.done && item.doneAt" class="done-at">已于 {{ formatDateTime(item.doneAt) }} 办完</div>
          </div>
          <button class="btn btn-secondary del-btn" @click.stop="remove(item)">删除</button>
        </div>
      </div>

      <div v-if="items.length === 0" class="empty">还没有准备事项，先在上面添加一条吧</div>
    </div>
  </div>
</template>

<style scoped>
.prep-card {
  padding: 12px 16px;
}
.prep-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.checkbox {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  border: 2px solid var(--border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #fff;
  flex-shrink: 0;
}
.checkbox.checked {
  background: var(--success);
  border-color: var(--success);
}
.prep-title {
  font-weight: 700;
  font-size: 15px;
}
.prep-title.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}
.prep-meta {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}
.done-at {
  font-size: 12px;
  color: var(--success);
  margin-top: 2px;
}
.same-day {
  margin-top: 12px;
}
.same-day-card {
  border: 1px solid var(--danger);
}
.del-btn {
  padding: 6px 10px;
  font-size: 12px;
  flex-shrink: 0;
}
</style>
