import { ref } from 'vue'
import * as XLSX from 'xlsx'

// 模块级共享状态——无论被多少个组件调用，数据只加载一次
const dataRaw = ref<any[]>([])
const totalCount = ref(0)
const loaded = ref(false)
const loading = ref(false)
const dataVersion = ref(0)  // 数据版本，变化时通知组件刷新
const sourceName = ref('data.xlsx')  // 当前数据源文件名
let loadPromise: Promise<void> | null = null

// 预期表头格式
const EXPECTED_HEADERS = ['排名', 'UID', '昵称', '评论数', '完全重复文案数', '首次评论时间', '最后评论时间', '评论内容示例(前3条)']

// 验证表头是否匹配（允许最后列名有前缀匹配，因为有些版本末尾可能略有差异）
function validateHeaders(headers: any[]): boolean {
  if (!Array.isArray(headers) || headers.length < 5) return false
  const keyCols = ['排名', 'UID', '昵称', '评论数', '完全重复文案数']
  return keyCols.every((name, i) => String(headers[i] || '').trim() === name)
}

// 从 parsed json 中提取数据行
function extractRows(json: any[][]) {
  // 第1行表头，第2行备注行，第3行起为数据
  return json.slice(2).filter((r: any) => r[0] !== undefined && typeof r[0] === 'number')
}

export function useExcelData() {
  async function loadData() {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loading.value = true
    loadPromise = (async () => {
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data.xlsx`)
        const blob = await resp.arrayBuffer()
        const workbook = XLSX.read(blob, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })
        dataRaw.value = extractRows(json)
        totalCount.value = dataRaw.value.length
        loaded.value = true
        sourceName.value = 'data.xlsx'
      } catch (e) {
        loaded.value = false
        loadPromise = null
        throw e
      } finally {
        loading.value = false
      }
    })()

    return loadPromise
  }

  // 从用户上传的 File 对象加载数据
  async function loadFromFile(file: File): Promise<{ ok: boolean; error?: string }> {
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })

      if (!json || json.length < 3) {
        return { ok: false, error: '文档数据不足，至少需要表头+备注行+数据行' }
      }

      // 验证表头
      const headers = json[0]
      if (!validateHeaders(headers)) {
        return { ok: false, error: '格式不匹配' }
      }

      // 解析数据
      const rows = extractRows(json)
      dataRaw.value = rows
      totalCount.value = rows.length
      sourceName.value = file.name
      loaded.value = true
      loadPromise = null
      dataVersion.value++  // 通知所有组件数据已变更

      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: '文件解析失败：' + e.message }
    }
  }

  return { dataRaw, totalCount, loaded, loading, dataVersion, sourceName, loadData, loadFromFile, EXPECTED_HEADERS }
}