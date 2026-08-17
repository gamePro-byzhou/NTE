<script setup lang="ts">
defineOptions({ name: 'CommentDialog' })

export interface UserInfo {
  rank: number
  nickname: string
  uid: string
  commentCount: number
  duplicateCount: number
  firstTime: string
  lastTime: string
}

export interface CommentItem {
  index: number
  content: string
}

const props = withDefaults(defineProps<{
  visible: boolean
  user?: UserInfo | null
  comments?: CommentItem[]
}>(), {
  user: null,
  comments: () => []
})

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
}>()

function onClose() {
  emit('update:visible', false)
}

function parseRow(row: any[]) {
  const rawComments = row[7] || ''
  const comments = String(rawComments)
    .split(/⏎/)
    .map((c: string) => c.trim())
    .filter((c: string) => c.length > 0)
  return comments.map((c: string, i: number) => ({ index: i + 1, content: c }))
}

// 从行数据解析出 userInfo
function rowToUser(row: any[], rank?: number): UserInfo {
  return {
    rank: rank ?? row[0],
    nickname: row[2] || '未知',
    uid: String(row[1] || '-'),
    commentCount: row[3] || 0,
    duplicateCount: row[4] || 0,
    firstTime: row[5] || '-',
    lastTime: row[6] || '-',
  }
}

defineExpose({ parseRow, rowToUser })
</script>

<template>
  <el-dialog
    :model-value="visible"
    :title="`${user?.nickname ?? ''} 的评论详情`"
    width="700px"
    top="8vh"
    destroy-on-close
    @update:model-value="onClose"
  >
    <template #default>
      <!-- 用户信息卡片 -->
      <el-card v-if="user" shadow="never" style="margin-bottom: 16px; background: #f5f7fa; border-radius: 8px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">排名</div>
            <div style="font-size: 15px; font-weight: bold; color: #303133;">#{{ user.rank }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">UID</div>
            <div style="font-size: 14px; color: #303133;">{{ user.uid }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">昵称</div>
            <div style="font-size: 14px; color: #303133;">{{ user.nickname }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">评论数</div>
            <div style="font-size: 15px; font-weight: bold; color: #409eff;">{{ user.commentCount }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">重复文案数</div>
            <div style="font-size: 15px; font-weight: bold; color: #e6a23c;">{{ user.duplicateCount }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">重复率</div>
            <div style="font-size: 15px; font-weight: bold; color: #f56c6c;">
              {{ user.commentCount > 0 ? ((user.duplicateCount / user.commentCount) * 100).toFixed(1) : 0 }}%
            </div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">首次评论时间</div>
            <div style="font-size: 13px; color: #303133;">{{ user.firstTime }}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #909399; margin-bottom: 2px;">最后评论时间</div>
            <div style="font-size: 13px; color: #303133;">{{ user.lastTime }}</div>
          </div>
        </div>
      </el-card>

      <!-- 评论表格 -->
      <el-table
        :data="comments"
        stripe
        border
        style="width: 100%"
        max-height="360"
        size="small"
      >
        <el-table-column prop="index" label="#" width="60" align="center" />
        <el-table-column prop="content" label="评论内容" min-width="400" show-overflow-tooltip>
          <template #default="{ row }">
            <div style="white-space: pre-wrap; line-height: 1.6;">{{ row.content }}</div>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </el-dialog>
</template>