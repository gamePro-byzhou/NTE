<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElCard, ElTable, ElTableColumn, ElButton, ElPagination, ElSelect, ElOption, ElTag, ElInput } from 'element-plus'
import { useExcelData } from '../composables/useExcelData'
import CommentDialog, { type UserInfo, type CommentItem } from '../components/CommentDialog.vue'

const { dataRaw, totalCount, loadData } = useExcelData()

const tableLoading = ref(true)
const pageSize = ref(50)
const currentPage = ref(1)

// 筛选条件
const filterType = ref<'all' | 'top100' | 'gt100' | 'gt10' | 'gt5'>('all')

// 搜索条件
const nicknameSearch = ref('')
const uidSearch = ref('')

// 筛选后的数据
const filteredData = computed(() => {
  let raw = dataRaw.value

  // 评论数筛选
  switch (filterType.value) {
    case 'top100':
      raw = raw.slice(0, 100)
      break
    case 'gt100':
      raw = raw.filter((r: any) => (r[3] || 0) > 100)
      break
    case 'gt10':
      raw = raw.filter((r: any) => (r[3] || 0) > 10)
      break
    case 'gt5':
      raw = raw.filter((r: any) => (r[3] || 0) > 5)
      break
  }

  // 昵称模糊搜索
  const nick = nicknameSearch.value.trim()
  if (nick) {
    raw = raw.filter((r: any) => String(r[2] || '').includes(nick))
  }

  // UID搜索（支持模糊匹配）
  const uid = uidSearch.value.trim()
  if (uid) {
    raw = raw.filter((r: any) => String(r[1] || '').includes(uid))
  }

  return raw
})

// 统计数据
const stats = computed(() => {
  const data = filteredData.value
  const userCount = data.length
  const totalComments = data.reduce((sum: number, r: any) => sum + (r[3] || 0), 0)
  const totalDuplicates = data.reduce((sum: number, r: any) => sum + (r[4] || 0), 0)
  const avgComments = userCount > 0 ? (totalComments / userCount).toFixed(1) : '0'
  const avgDupRate = totalComments > 0 ? ((totalDuplicates / totalComments) * 100).toFixed(1) : '0'
  return { userCount, totalComments, totalDuplicates, avgComments, avgDupRate }
})

// 筛选后的分页数据
const pageData = computed(() => {
  const data = filteredData.value
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return data.slice(start, end)
})

// 切换筛选
function onFilterChange(val: string) {
  filterType.value = val as any
  resetPage()
}

// 搜索
function onNicknameInput() {
  resetPage()
}

function onUidInput() {
  resetPage()
}

function resetPage() {
  currentPage.value = 1
}

// 弹窗状态
const dialogVisible = ref(false)
const dialogUser = ref<UserInfo | null>(null)
const dialogComments = ref<CommentItem[]>([])
const dialogRef = ref<InstanceType<typeof CommentDialog>>()

function showDetail(row: any, rank: number) {
  if (dialogRef.value) {
    dialogUser.value = dialogRef.value.rowToUser(row, rank)
    dialogComments.value = dialogRef.value.parseRow(row)
    dialogVisible.value = true
  }
}

function onPageChange(page: number) {
  currentPage.value = page
}

function onSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
}

onMounted(async () => {
  try {
    tableLoading.value = true
    await loadData()
  } catch (e: any) {
    ElMessage.error('数据加载失败：' + e.message)
  } finally {
    tableLoading.value = false
  }
})
</script>

<template>
  <el-card shadow="hover" style="margin: 20px; border-radius: 12px;">
    <template #header>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <!-- 标题行 -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div>
            <h2 style="margin: 0; font-size: 20px; color: #303133;">📋 评论数据表格</h2>
            <span style="font-size: 13px; color: #909399;">
              数据来源：评论统计(降序) · 共 {{ totalCount }} 条记录
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <!-- 昵称搜索 -->
            <el-input
              v-model="nicknameSearch"
              placeholder="搜索昵称..."
              size="small"
              clearable
              style="width: 160px;"
              @input="onNicknameInput"
              @clear="onNicknameInput"
            >
              <template #prefix>
                <span style="font-size: 14px;">🔍</span>
              </template>
            </el-input>
            <!-- UID搜索 -->
            <el-input
              v-model="uidSearch"
              placeholder="搜索UID..."
              size="small"
              clearable
              style="width: 160px;"
              @input="onUidInput"
              @clear="onUidInput"
            >
              <template #prefix>
                <span style="font-size: 14px;">🔍</span>
              </template>
            </el-input>
            <!-- 评论数筛选 -->
            <span style="font-size: 13px; color: #606266; margin-left: 4px;">筛选：</span>
            <el-select
              :model-value="filterType"
              @update:model-value="onFilterChange"
              style="width: 150px;"
              size="small"
            >
              <el-option value="all" label="全部" />
              <el-option value="top100" label="评论数前100" />
              <el-option value="gt100" label="评论数大于100" />
              <el-option value="gt10" label="评论数大于10" />
              <el-option value="gt5" label="评论数大于5" />
            </el-select>
          </div>
        </div>

        <!-- 统计行 -->
        <div style="display: flex; flex-wrap: wrap; gap: 16px; padding: 12px 16px; background: #f5f7fa; border-radius: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #909399;">👤 用户数</span>
            <el-tag type="info" effect="plain" size="small">{{ stats.userCount }}</el-tag>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #909399;">💬 总评论数</span>
            <el-tag type="primary" effect="plain" size="small">{{ stats.totalComments.toLocaleString() }}</el-tag>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #909399;">🔁 总重复文案</span>
            <el-tag type="warning" effect="plain" size="small">{{ stats.totalDuplicates.toLocaleString() }}</el-tag>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #909399;">📊 人均评论</span>
            <el-tag effect="plain" size="small">{{ stats.avgComments }}</el-tag>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 12px; color: #909399;">📈 平均重复率</span>
            <el-tag type="danger" effect="plain" size="small">{{ stats.avgDupRate }}%</el-tag>
          </div>
        </div>
      </div>
    </template>

    <el-table
      :data="pageData"
      v-loading="tableLoading"
      stripe
      border
      style="width: 100%"
      size="small"
      height="calc(100vh - 260px)"
    >
      <el-table-column label="排名" width="70" align="center">
        <template #default="{ $index }">
          <span style="font-weight: bold; color: #409eff;">#{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="UID" width="140" align="center">
        <template #default="{ row }">
          <span style="font-size: 12px; color: #909399;">{{ row[1] || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="2" label="昵称" min-width="140" show-overflow-tooltip />
      <el-table-column label="评论数" width="100" align="center">
        <template #default="{ row }">
          <span style="font-weight: bold; color: #409eff;">{{ row[3] || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="完全重复文案" width="120" align="center">
        <template #default="{ row }">
          <span style="font-weight: bold; color: #e6a23c;">{{ row[4] || 0 }}</span>
        </template>
      </el-table-column>
      <el-table-column label="重复率" width="100" align="center">
        <template #default="{ row }">
          <span style="font-weight: bold; color: #f56c6c;">
            {{ row[3] > 0 ? ((row[4] / row[3]) * 100).toFixed(1) : 0 }}%
          </span>
        </template>
      </el-table-column>
      <el-table-column label="首次评论" width="150" align="center">
        <template #default="{ row }">
          <span style="font-size: 12px;">{{ row[5] || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="最后评论" width="150" align="center">
        <template #default="{ row }">
          <span style="font-size: 12px;">{{ row[6] || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="110" align="center" fixed="right">
        <template #default="{ row, $index }">
          <el-button type="primary" size="small" @click="showDetail(row, (currentPage - 1) * pageSize + $index + 1)">
            查看详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="display: flex; justify-content: center; margin-top: 16px;">
      <el-pagination
        v-if="filteredData.length > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="filteredData.length"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>
  </el-card>

  <CommentDialog
    ref="dialogRef"
    v-model:visible="dialogVisible"
    :user="dialogUser"
    :comments="dialogComments"
  />
</template>

<style scoped>
:deep(.el-card__header) {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}
:deep(.el-table th.el-table__cell) {
  background-color: #f5f7fa;
}
</style>