import { toastSuccess } from '@/lib/alerts'
import { generateRandomPassword } from '@/lib/password'

export function useGeneratedPassword(apply: (password: string) => void) {
  async function generatePassword() {
    const password = generateRandomPassword()
    apply(password)

    try {
      await navigator.clipboard.writeText(password)
      toastSuccess('Senha gerada e copiada para a área de transferência')
    } catch {
      toastSuccess('Senha gerada')
    }
  }

  return { generatePassword }
}
