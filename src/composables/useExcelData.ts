import { ref } from 'vue'
import * as XLSX from 'xlsx'

// 必需列：上传文件必须具备，缺失时拒绝加载并要求重新上传
const REQUIRED_KEYS = ['UID', '昵称', '评论数']

// 标准字段定义：key 为统一字段名，pattern 用于从任意表头中识别对应列
const STANDARD_FIELDS: { key: string; pattern: RegExp }[] = [
  { key: '排名', pattern: /^(排名|rank)$/i },
  { key: 'UID', pattern: /^uid$|用户\s*id|user\s*id/i },
  { key: '昵称', pattern: /昵称|用户名|用户名称|nickname|name/i },
  { key: '评论数', pattern: /评论数|评论次数|评论总量|评论数量|^评论$|comment/i },
  { key: '完全重复文案数', pattern: /重复|duplicate/i },
  { key: '首次评论时间', pattern: /首次|首评|first/i },
  { key: '最后评论时间', pattern: /最后|末次|last/i },
  { key: '评论内容示例', pattern: /评论(?!数|次|总|时间)|content|sample|example/i },
]

// 模块级共享状态——无论被多少个组件调用，数据只加载一次
const dataRaw = ref<any[]>([]) // 行数据（对象形式，key 为表头名/标准字段名）
const headers = ref<string[]>([]) // 当前数据源的实际表头
const colMap = ref<Record<string, number>>({}) // 实际表头名 -> 列索引
const totalCount = ref(0)
const loaded = ref(false)
const loading = ref(false)
const dataVersion = ref(0) // 数据版本，变化时通知组件刷新
const sourceName = ref('data.xlsx') // 当前数据源文件名
let loadPromise: Promise<void> | null = null

// 解析表头：去除空列，返回实际表头及列索引映射
function parseHeaders(json: any[][]): { headers: string[]; colMap: Record<string, number> } {
  const hdrs: string[] = []
  const map: Record<string, number> = {}
  ;(json[0] || []).forEach((h: any, i: number) => {
    const name = String(h ?? '').trim()
    if (name) {
      hdrs.push(name)
      map[name] = i
    }
  })
  return { headers: hdrs, colMap: map }
}

// 提取数据行：第1行为表头；若第2行首格是数字则视为数据行（文件无备注行），否则第2行为备注行，从第3行取数
function extractRows(json: any[][]) {
  const second = json[1]
  const start = Array.isArray(second) && typeof second[0] === 'number' ? 1 : 2
  return json
    .slice(start)
    .filter((r: any) => Array.isArray(r) && r.some((v: any) => v !== undefined && v !== null && v !== ''))
}

// 将行转为对象：key 同时包含原始表头名与识别出的标准字段名
function toRowObjects(json: any[][], hdrs: string[], map: Record<string, number>): any[] {
  return extractRows(json).map(r => {
    const obj: Record<string, any> = {}
    hdrs.forEach((h, i) => {
      obj[h] = r[i]
    })
    // 将匹配到的标准字段名也作为 key（若原始表头已是标准名则跳过）
    STANDARD_FIELDS.forEach(({ key, pattern }) => {
      const hit = hdrs.find(h => pattern.test(h))
      if (hit && !(key in obj)) obj[key] = r[map[hit]]
    })
    return obj
  })
}

// 统一解析工作簿并写入共享状态
function applyWorkbook(workbook: XLSX.WorkBook, name: string) {
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('文档中没有工作表')
  const sheet = workbook.Sheets[sheetName]
  const json = XLSX.utils.sheet_to_json<any>(sheet, { header: 1 })
  if (!Array.isArray(json) || json.length === 0) throw new Error('文档中没有数据')

  const { headers: hdrs, colMap: map } = parseHeaders(json)
  // 校验必需列（UID、昵称、评论数），缺失时拒绝加载并要求重新上传
  const missing = REQUIRED_KEYS.filter(key => {
    const std = STANDARD_FIELDS.find(s => s.key === key)
    return !std || !hdrs.some(h => std.pattern.test(h))
  })
  if (missing.length > 0) {
    throw new Error(`缺少必需列：${missing.join('、')}。请重新上传包含「UID、昵称、评论数」列的文件，请确保放在第一列。没向下扫描`)
  }
  dataRaw.value = toRowObjects(json, hdrs, map)
  headers.value = hdrs
  colMap.value = map
  totalCount.value = dataRaw.value.length
  sourceName.value = name
  loaded.value = true
  loadPromise = null
  dataVersion.value++ // 通知所有组件数据已变更
}

export function useExcelData() {
  async function loadData() {
    if (loaded.value) return
    if (loadPromise) return loadPromise

    loading.value = true
    loadPromise = (async () => {
      try {
        const resp = await fetch(`${import.meta.env.BASE_URL}data.xlsx`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const blob = await resp.arrayBuffer()
        const workbook = XLSX.read(blob, { type: 'array' })
        applyWorkbook(workbook, 'data.xlsx')
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
      applyWorkbook(workbook, file.name)
      if (dataRaw.value.length === 0) {
        return { ok: false, error: '未找到有效数据行' }
      }
      return { ok: true }
    } catch (e: any) {
      return { ok: false, error: e?.message || '文件解析失败' }
    }
  }

  // 返回标准字段对应的实际表头名（未识别到时返回 undefined）
  function standardHeaderName(key: string): string | undefined {
    const std = STANDARD_FIELDS.find(s => s.key === key)
    if (!std) return undefined
    return headers.value.find(h => std.pattern.test(h))
  }

  // 是否识别到重复文案列（表头包含「重复文案」或 duplicate）
  function hasDupColumn(): boolean {
    return !!standardHeaderName('完全重复文案数')
  }

  return {
    dataRaw,
    headers,
    colMap,
    totalCount,
    loaded,
    loading,
    dataVersion,
    sourceName,
    loadData,
    loadFromFile,
    standardHeaderName,
    hasDupColumn,
  }
}
