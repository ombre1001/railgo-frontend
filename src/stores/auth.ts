import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/api'
import type { UserProfile } from '@/types/api'
import { hasAdminRole, normalizeUserProfile } from '@/utils/roles'

function readCachedUser(): UserProfile | null {
  try {
    const value = localStorage.getItem('railgo_user')
    return value ? normalizeUserProfile(JSON.parse(value) as UserProfile) : null
  } catch {
    localStorage.removeItem('railgo_user')
    return null
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('railgo_access_token') || '')
  const refreshToken = ref(localStorage.getItem('railgo_refresh_token') || '')
  const user = ref<UserProfile | null>(readCachedUser())
  const sessionChecked = ref(false)
  let sessionRequest: Promise<UserProfile | null> | null = null
  const isLoggedIn = computed(() => Boolean(token.value))
  const isAdmin = computed(() => hasAdminRole(user.value))

  function saveUser(profile: UserProfile | null) {
    user.value = profile ? normalizeUserProfile(profile) : null
    if (user.value) localStorage.setItem('railgo_user', JSON.stringify(user.value))
    else localStorage.removeItem('railgo_user')
  }

  function clearSession() {
    token.value = ''
    refreshToken.value = ''
    saveUser(null)
    sessionChecked.value = true
    localStorage.removeItem('railgo_access_token')
    localStorage.removeItem('railgo_refresh_token')
  }

  async function refreshProfile() {
    const profile = normalizeUserProfile(await api.user.profile())
    saveUser(profile)
    sessionChecked.value = true
    return profile
  }

  async function login(account: string, password: string) {
    const result = await api.auth.login({ account, password })
    token.value = result.accessToken
    refreshToken.value = result.refreshToken
    localStorage.setItem('railgo_access_token', result.accessToken)
    localStorage.setItem('railgo_refresh_token', result.refreshToken)
    saveUser(result.user)
    sessionChecked.value = false

    // 登录后立即重新读取 /users/me。数据库角色调整后，无需依赖旧缓存。
    try {
      return await refreshProfile()
    } catch (error) {
      clearSession()
      throw error
    }
  }

  async function ensureSession() {
    if (!token.value) {
      clearSession()
      return null
    }
    if (sessionChecked.value) return user.value
    if (sessionRequest) return sessionRequest

    sessionRequest = refreshProfile()
      .catch(() => {
        clearSession()
        return null
      })
      .finally(() => { sessionRequest = null })
    return sessionRequest
  }

  async function logout() {
    try { await api.auth.logout(refreshToken.value) } catch { /* local cleanup still applies */ }
    clearSession()
  }

  return { token, refreshToken, user, sessionChecked, isLoggedIn, isAdmin, login, logout, refreshProfile, ensureSession }
})
