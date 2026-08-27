import { computed } from 'vue'
import { isManagerRole } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth'

export function usePermissions() {
  const auth = useAuthStore()
  const canManage = computed(() => isManagerRole(auth.user?.role))

  return { canManage }
}
