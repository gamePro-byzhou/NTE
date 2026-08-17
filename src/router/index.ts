import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/chart'
    },
    {
      path: '/chart',
      name: 'chart',
      component: () => import('../views/ChartView.vue')
    },
    {
      path: '/table',
      name: 'table',
      component: () => import('../views/TableView.vue')
    }
  ]
})

export default router