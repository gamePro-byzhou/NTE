<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import * as echarts from 'echarts'
import VChart from 'vue-echarts'
import { ElMessage, ElCard, ElSelect, ElOption, ElSkeleton } from 'element-plus'
import { useExcelData } from '../composables/useExcelData'
import CommentDialog, { type UserInfo, type CommentItem } from '../components/CommentDialog.vue'

const { dataRaw, totalCount, dataVersion, loadData, standardHeaderName, hasDupColumn } = useExcelData()

const chartLoading = ref(true)
const chartOptions = ref({})
const topN = ref(50)

// 实际表头名（用于图例/坐标轴名称，识别不到时回退到标准名）
const commentName = computed(() => standardHeaderName('评论数') || '评论数')
const dupName = computed(() => standardHeaderName('完全重复文案数') || '完全重复文案数')

// 是否存在可绘制的数据（评论数列为必需列，存在即可能绘制）
const hasChartData = computed(() =>
  dataRaw.value.length > 0 && dataRaw.value.some((r: any) => Number(r['评论数']) > 0)
)

// 弹窗状态
const dialogVisible = ref(false)
const dialogUser = ref<UserInfo | null>(null)
const dialogComments = ref<CommentItem[]>([])

const dialogRef = ref<InstanceType<typeof CommentDialog>>()

function updateChart() {
  const rows = dataRaw.value.slice(0, topN.value)
  const ranks = rows.map((_: any, i: number) => i + 1)
  const comments = rows.map((r: any) => Number(r['评论数']) || 0)
  const nicknames = rows.map((r: any) => r['昵称'] || '')
  // 有重复文案列时才绘制重复文案曲线
  const hasDup = hasDupColumn()
  const duplicates = hasDup ? rows.map((r: any) => Number(r['完全重复文案数']) || 0) : []

  const yAxis: any[] = [
    {
      type: 'value', name: commentName.value,
      nameTextStyle: { fontSize: 13, fontWeight: 'bold' },
      splitLine: { lineStyle: { type: 'dashed', color: '#e8e8e8' } }
    }
  ]
  if (hasDup) {
    yAxis.push({
      type: 'value', name: dupName.value,
      nameTextStyle: { fontSize: 13, fontWeight: 'bold' },
      splitLine: { show: false }
    })
  }

  const series: any[] = [
    {
      name: commentName.value, type: 'line',
      data: comments, smooth: true,
      symbol: 'circle', symbolSize: 6,
      lineStyle: { width: 2.5, color: '#409eff' },
      itemStyle: { color: '#409eff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.3)' },
          { offset: 1, color: 'rgba(64,158,255,0.02)' }
        ])
      }
    }
  ]
  if (hasDup) {
    series.push({
      name: dupName.value, type: 'line',
      yAxisIndex: 1,
      data: duplicates, smooth: true,
      symbol: 'diamond', symbolSize: 6,
      lineStyle: { width: 2.5, color: '#e6a23c' },
      itemStyle: { color: '#e6a23c' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(230,162,60,0.25)' },
          { offset: 1, color: 'rgba(230,162,60,0.02)' }
        ])
      }
    })
  }

  chartOptions.value = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255,255,255,0.95)',
      borderColor: '#409eff',
      borderWidth: 2,
      textStyle: { color: '#333', fontSize: 13 },
      formatter: (params: any[]) => {
        const idx = params[0].dataIndex
        const nick = nicknames[idx] || '未知'
        const rank = ranks[idx]
        let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #eee;padding-bottom:4px">🏅 排名 #${rank} · ${nick}</div>`
        params.forEach((p: any) => {
          html += `<div style="display:flex;justify-content:space-between;gap:20px">
            <span>${p.marker} ${p.seriesName}</span>
            <span style="font-weight:bold">${p.value}</span>
          </div>`
        })
        return html
      }
    },
    legend: {
      data: hasDup ? [commentName.value, dupName.value] : [commentName.value],
      top: 10,
      textStyle: { fontSize: 14 }
    },
    grid: { left: 70, right: 40, top: 60, bottom: 80 },
    xAxis: {
      type: 'category',
      data: ranks,
      name: '排名',
      nameTextStyle: { fontSize: 13, fontWeight: 'bold' },
      axisLabel: { interval: Math.max(0, Math.floor(topN.value / 20)), fontSize: 11 }
    },
    yAxis,
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      {
        type: 'slider', start: 0, end: 100,
        height: 30, bottom: 10,
        borderColor: '#dcdfe6',
        fillerColor: 'rgba(64,158,255,0.15)',
        handleStyle: { color: '#409eff' },
        textStyle: { fontSize: 11 }
      }
    ],
    series
  } as any

  chartLoading.value = false
}

function onChartClick(params: any) {
  const idx = params.dataIndex
  if (idx === undefined || idx < 0 || idx >= dataRaw.value.length) return
  const row = dataRaw.value[idx]
  if (dialogRef.value) {
    dialogUser.value = dialogRef.value.rowToUser(row, idx + 1)
    dialogComments.value = dialogRef.value.parseRow(row)
    dialogVisible.value = true
  }
}

function onTopNChange(val: number) {
  topN.value = val
  updateChart()
}

// 数据变动时刷新图表
watch(dataVersion, () => {
  chartLoading.value = true
  updateChart()
  chartLoading.value = false
})

onMounted(async () => {
  try {
    chartLoading.value = true
    await loadData()
    updateChart()
  } catch (e: any) {
    ElMessage.error('数据加载失败：' + e.message)
  } finally {
    chartLoading.value = false
  }
})
</script>

<template>
  <el-card shadow="hover" style="margin: 20px; border-radius: 12px;">
    <template #header>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h2 style="margin: 0; font-size: 20px; color: #303133;">📊 评论统计折线图</h2>
          <span style="font-size: 13px; color: #909399;">数据来源：评论统计(降序) · 共 {{ totalCount }} 条记录</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 13px; color: #606266;">显示前</span>
          <el-select :model-value="topN" @update:model-value="onTopNChange" style="width: 100px;" size="small">
            <el-option :value="20" label="20名" />
            <el-option :value="50" label="50名" />
            <el-option :value="100" label="100名" />
            <el-option :value="200" label="200名" />
            <el-option :value="500" label="500名" />
            <el-option :value="1000" label="1000名" />
            <el-option :value="totalCount" :label="`全部(${totalCount})`" />
          </el-select>
          <span style="font-size: 13px; color: #606266;">名</span>
        </div>
      </div>
    </template>

    <el-skeleton :loading="chartLoading" animated style="height: 500px;">
      <template #default>
        <div style="height: 520px; width: 100%;">
          <VChart
            v-if="!chartLoading && hasChartData"
            :option="chartOptions"
            autoresize
            style="height: 100%; width: 100%;"
            @click="onChartClick"
          />
          <el-empty
            v-else-if="!chartLoading"
            description="暂无可绘制的数据"
            :image-size="120"
            style="height: 100%; display: flex; flex-direction: column; justify-content: center;"
          />
        </div>
      </template>
    </el-skeleton>
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
</style>