<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import DetailField from '@/components/ui/DetailField.vue'
import FormTabs, { type FormTab } from '@/components/ui/FormTabs.vue'
import { useAuthStore } from '@/stores/auth'
import { useFieldErrors } from '@/composables/useFieldErrors'
import { validateNewPassword } from '@/lib/passwordForm'
import { changePassword, fetchOwnPersonalData } from '@/services/authService'
import { fetchOwnCompany, type CompanyDetailsInput } from '@/services/companiesService'
import { formatCnpj, formatPhone, formatCep } from '@/lib/format'
import { getApiErrorMessage, resolveFormError } from '@/services/api'
import { toastError, toastSuccess } from '@/lib/alerts'
import { Building2, Download, KeyRound, UserRound } from '@lucide/vue'
import { downloadBlob } from '@/lib/download'
import { roleLabel } from '@/lib/roles'
import { LIMITES_TEXTO } from '@/lib/limits'

const auth = useAuthStore()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const saving = ref(false)
const errorMessage = ref('')

const { fieldErrors } = useFieldErrors(() => ({
  currentPassword: currentPassword.value,
  newPassword: newPassword.value,
  confirmPassword: confirmPassword.value,
}))

function validate(): boolean {
  fieldErrors.value = {}
  if (!currentPassword.value) fieldErrors.value.currentPassword = 'Informe a senha atual'
  validateNewPassword(newPassword.value, confirmPassword.value, fieldErrors.value)

  return Object.keys(fieldErrors.value).length === 0
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true
  try {
    await changePassword(currentPassword.value, newPassword.value)
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    toastSuccess('Senha alterada com sucesso')
  } catch (error) {
    // Senha atual errada volta como erro de campo; o resto é mensagem do formulário.
    const resolvido = resolveFormError(error, 'Não foi possível alterar a senha')
    fieldErrors.value = resolvido.fieldErrors
    errorMessage.value = Object.keys(resolvido.fieldErrors).length ? '' : resolvido.message
  } finally {
    saving.value = false
  }
}

// O `super_admin` em modo suporte cai aqui como `admin` e vê a empresa visitada, que é o esperado.
const company = ref<CompanyDetailsInput | null>(null)
const companyError = ref('')
const podeVerEmpresa = computed(() => auth.user?.role === 'admin')

type Aba = 'conta' | 'empresa' | 'senha'

const aba = ref<Aba>('conta')

// Sem numeração: são seções independentes, e "1. Minha conta" sugeriria um caminho a percorrer.
const abas = computed<Array<FormTab<Aba>>>(() => [
  { id: 'conta', label: 'Minha conta', icon: UserRound },
  ...(podeVerEmpresa.value ? [{ id: 'empresa' as const, label: 'Empresa', icon: Building2 }] : []),
  { id: 'senha', label: 'Senha', icon: KeyRound },
])

const enderecoDaEmpresa = computed(() => {
  const dados = company.value
  if (!dados) return ''

  const rua = [dados.street, dados.addressNumber].filter(Boolean).join(', ')
  const complemento = dados.complement ? ` ${dados.complement}` : ''
  const cidade = [dados.city, dados.state].filter(Boolean).join(' / ')
  return [`${rua}${complemento}`, dados.district, cidade].filter(Boolean).join(' - ')
})

onMounted(async () => {
  if (!podeVerEmpresa.value) return

  try {
    company.value = await fetchOwnCompany()
  } catch (error) {
    companyError.value = getApiErrorMessage(error, 'Não foi possível carregar os dados da empresa')
  }
})

const downloading = ref(false)

async function handleDownloadPersonalData() {
  if (downloading.value) return

  downloading.value = true
  try {
    const data = await fetchOwnPersonalData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(`meus-dados-${new Date().toISOString().slice(0, 10)}.json`, blob)
    toastSuccess('Download dos seus dados iniciado')
  } catch (error) {
    toastError(getApiErrorMessage(error, 'Não foi possível baixar seus dados'))
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Meu perfil" subtitle="Seus dados de acesso" />

    <div class="max-w-3xl rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <FormTabs v-model="aba" :tabs="abas" aria-label="Seções do perfil" />

      <div v-show="aba === 'conta'">
        <dl class="grid gap-4 sm:grid-cols-2">
          <DetailField label="Nome">{{ auth.user?.name }}</DetailField>
          <DetailField label="E-mail">{{ auth.user?.email }}</DetailField>
          <DetailField label="Perfil">{{ roleLabel(auth.user?.role) }}</DetailField>
        </dl>

        <div class="mt-6 border-t border-gray-100 pt-5 dark:border-gray-700">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">Meus dados pessoais</h3>
          <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Baixe tudo o que o sistema guarda sobre você: seu cadastro e o histórico das ações que você
            registrou. O arquivo é seu e pode ser aberto em qualquer computador.
          </p>
          <BaseButton
            type="button"
            variant="secondary"
            class="mt-3"
            :disabled="downloading"
            @click="handleDownloadPersonalData"
          >
            <Download :size="16" />
            {{ downloading ? 'Preparando...' : 'Baixar meus dados' }}
          </BaseButton>
          <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Quer saber o que o sistema guarda e por quanto tempo? Leia o
            <RouterLink
              :to="{ name: 'privacidade' }"
              target="_blank"
              class="text-primary-700 hover:underline dark:text-primary-400"
            >aviso de privacidade</RouterLink>.
          </p>
        </div>
      </div>

      <div v-if="podeVerEmpresa" v-show="aba === 'empresa'">
        <p v-if="companyError" class="text-sm text-red-600 dark:text-red-400">{{ companyError }}</p>
        <p v-else-if="!company" class="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>

        <template v-else>
          <dl class="grid gap-4 sm:grid-cols-2">
            <DetailField label="Nome fantasia">{{ company.name }}</DetailField>
            <DetailField label="Razão social">{{ company.legalName || 'Não informada' }}</DetailField>
            <DetailField label="CNPJ">{{ formatCnpj(company.document) || 'Não informado' }}</DetailField>
            <DetailField label="Inscrição estadual">{{ company.stateRegistration || 'Não informada' }}</DetailField>
            <DetailField label="Responsável">{{ company.contactName || 'Não informado' }}</DetailField>
            <DetailField label="E-mail de contato">{{ company.contactEmail || 'Não informado' }}</DetailField>
            <DetailField label="Telefone">{{ formatPhone(company.phone) || 'Não informado' }}</DetailField>
            <DetailField label="CEP">{{ formatCep(company.postalCode) || 'Não informado' }}</DetailField>
            <DetailField label="Endereço" wide>{{ enderecoDaEmpresa || 'Não informado' }}</DetailField>
          </dl>

          <p class="mt-6 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            Precisa corrigir algum destes dados? Fale com o suporte. Razão social e CNPJ constam do
            contrato, então a alteração é feita por lá e não pela própria tela.
          </p>
        </template>
      </div>

      <div v-show="aba === 'senha'">
        <form class="max-w-sm space-y-4" novalidate @submit.prevent="handleSubmit">
          <BaseInput
            v-model="currentPassword"
            type="password"
            label="Senha atual"
            :maxlength="LIMITES_TEXTO.senha"
            :error="fieldErrors.currentPassword"
            required
          />
          <BaseInput
            v-model="newPassword"
            type="password"
            label="Nova senha"
            :maxlength="LIMITES_TEXTO.senha"
            :error="fieldErrors.newPassword"
            required
          />
          <BaseInput
            v-model="confirmPassword"
            type="password"
            label="Confirmar nova senha"
            :maxlength="LIMITES_TEXTO.senha"
            :error="fieldErrors.confirmPassword"
            required
          />

          <p v-if="errorMessage" class="text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>
          <BaseButton type="submit" :disabled="saving">
            {{ saving ? 'Salvando...' : 'Alterar senha' }}
          </BaseButton>
        </form>

        <p class="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
          Ao trocar a senha, qualquer outra sessão aberta com a senha antiga é encerrada. A sua
          continua funcionando.
        </p>
      </div>
    </div>
  </div>
</template>
