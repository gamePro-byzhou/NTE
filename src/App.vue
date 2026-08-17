<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMenu, ElMenuItem, ElButton, ElDialog, ElMessage } from 'element-plus'
import { useExcelData } from './composables/useExcelData'

const router = useRouter()
const route = useRoute()
const { loadFromFile, EXPECTED_HEADERS, sourceName } = useExcelData()

const fileInput = ref<HTMLInputElement>()
const formatErrorVisible = ref(false)

function onMenuClick(index: string) {
  router.push(index)
}

// 触发文件选择
function triggerUpload() {
  fileInput.value?.click()
}

// 文件选择后处理
async function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  // 检查文件扩展名
  if (!file.name.endsWith('.xlsx')) {
    ElMessage.warning('请上传 .xlsx 格式的文件')
    input.value = ''
    return
  }

  const result = await loadFromFile(file)
  if (result.ok) {
    ElMessage.success(`已成功加载「${file.name}」，共 ${useExcelData().totalCount.value} 条数据`)
    // 如果当前在图表页，触发页面级刷新
    window.dispatchEvent(new CustomEvent('excel-data-changed'))
  } else {
    if (result.error === '格式不匹配') {
      formatErrorVisible.value = true
    } else {
      ElMessage.error(result.error || '文件解析失败')
    }
  }

  // 重置 file input 以便重复选择同一文件
  input.value = ''
}

// 下载模板文件
function downloadTemplate() {
  const a = document.createElement('a')
  a.href = '/data.xlsx'
  a.download = 'data.xlsx'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  formatErrorVisible.value = false
}
</script>

<template>
  <div class="app-container">
    <div class="nav-bar">
      <el-menu
        :default-active="route.path"
        mode="horizontal"
        @select="onMenuClick"
        style="flex: 1; border-radius: 0;"
      >
        <el-menu-item index="/chart">
          <span style="margin-right: 6px;">📊</span>
          折线图
        </el-menu-item>
        <el-menu-item index="/table">
          <span style="margin-right: 6px;">📋</span>
          数据表格
        </el-menu-item>
      </el-menu>
      <div class="upload-section">
        <span class="source-label" :title="sourceName">{{ sourceName }}</span>
        <el-button type="primary" size="small" @click="triggerUpload">
          📤 上传文档
        </el-button>
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx"
          style="display: none;"
          @change="onFileSelected"
        />
      </div>
    </div>
    <div class="page-content">
      <router-view />
    </div>
  </div>

  <!-- 格式错误提示弹窗 -->
  <el-dialog
    v-model="formatErrorVisible"
    title="格式不匹配"
    width="420px"
    :close-on-click-modal="false"
  >
    <div style="padding: 8px 0;">
      <div style="font-size: 16px; margin-bottom: 12px;">
        ⚠️ 上传的文档格式与当前数据格式不一致
      </div>
      <div style="font-size: 13px; color: #909399; line-height: 1.6;">
        当前文档需要包含以下表头列：
        <div style="margin: 8px 0; padding: 8px 12px; background: #f5f7fa; border-radius: 6px; font-size: 12px; color: #606266;">
          {{ EXPECTED_HEADERS.join('  ·  ') }}
        </div>
        是否下载标准格式模板文档？
      </div>
    </div>
    <template #footer>
      <el-button @click="formatErrorVisible = false">否</el-button>
      <el-button type="primary" @click="downloadTemplate">是，下载模板</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.app-container {
  width: 100%;
  min-height: 100vh;
  background: #f5f7fa;
}
.nav-bar {
  display: flex;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
.upload-section {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  white-space: nowrap;
}
.source-label {
  font-size: 12px;
  color: #909399;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.page-content {
  padding: 0;
}
</style>