import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from './stores/auth'
import FoundationView from './views/FoundationView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'foundation',
      component: FoundationView,
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./views/LoginView.vue'),
    },
    {
      path: '/console',
      component: () => import('./components/ConsoleLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'console',
          component: () => import('./views/ConsoleView.vue'),
        },
        {
          path: 'knowledge',
          name: 'console-knowledge',
          component: () => import('./views/KnowledgeView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()
  await authStore.initialize()

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.name === 'login' && authStore.isAuthenticated) {
    return { name: 'console' }
  }

  return true
})
