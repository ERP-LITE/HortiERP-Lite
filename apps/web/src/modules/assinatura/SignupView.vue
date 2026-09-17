<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { BadgeCheck, Building2, MapPin, UserCog } from '@lucide/vue'
import AuthLayout from '@/layouts/AuthLayout.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue'
import FormTabs, { type FormTab } from '@/components/ui/FormTabs.vue'
import CompanyFormFields from '@/components/empresa/CompanyFormFields.vue'
import { useAsyncState } from '@/composables/useAsyncState'
import { useCepLookup } from '@/composables/useCepLookup'
import { useFieldErrors } from '@/composables/useFieldErrors'
import { resolveFormError } from '@/services/api'
import { listPlans, signUp, type Plan } from '@/services/subscriptionService'
import { toastSuccess } from '@/lib/alerts'
import { formatCurrency } from '@/lib/format'
import {
  CAMPOS_DA_ABA_ENDERECO,
  CAMPOS_DA_ABA_GERAL,
  emptyAdminForm,
  emptyCompanyForm,
  primeiraAbaComErro,
  validateAdminFields,
  validateCompanyFields,
} from '@/lib/companyForm'
import { LIMITES_TEXTO } from '@/lib/limits'

type Aba = 'plano' | 'company' | 'address' | 'admin'

const router = useRouter()
const { loading, errorMessage, withLoading } = useAsyncState()

const plans = ref<Plan[]>([])
const planId = ref('')
const form = ref(emptyCompanyForm())
const adminForm = ref(emptyAdminForm())
const privacyAccepted = ref(false)
const saving = ref(false)
const aba = ref<Aba>('plano')

const { fieldErrors } = useFieldErrors(() => ({
  ...form.value,
  ...adminForm.value,
  planId: planId.value,
  privacyAccepted: privacyAccepted.value,
}))
const { lookingUpCep } = useCepLookup(form, fieldErrors)

const abas: Array<FormTab<Aba>> = [
  { id: 'plano', label: 'Plano', icon: BadgeCheck },
  { id: 'company', label: 'Dados gerais', icon: Building2 },
  { id: 'address', label: 'Endereço', icon: MapPin },
  { id: 'admin', label: 'Seu acesso', icon: UserCog },
]

const planoEscolhido = computed(() => plans.value.find((plan) => plan.id === planId.value))

async function carregarPlanos() {
  await withLoading(async () => {
    plans.value = await listPlans()
    // Com um plano só, escolher pela pessoa poupa um clique sem esconder nada: o cartão continua na
    // tela, marcado, e ela vê o preço e o prazo antes de qualquer campo.
    if (plans.value.length === 1) planId.value = plans.value[0].id
  })
}

function validate(): boolean {
  fieldErrors.value = {}
  if (!planId.value) fieldErrors.value.planId = 'Escolha um plano para continuar'
  validateCompanyFields(form.value, fieldErrors.value)
  validateAdminFields(adminForm.value, fieldErrors.value)
  if (!privacyAccepted.value) fieldErrors.value.privacyAccepted = 'É preciso concordar com o aviso de privacidade'

  focarAbaComErro()
  return Object.keys(fieldErrors.value).length === 0
}

function focarAbaComErro() {
  const campos = Object.keys(fieldErrors.value)
  if (!campos.length) return

  // Sem aba correspondente sobra a última, que é onde ficam os campos do acesso e o aceite.
  aba.value =
    primeiraAbaComErro(campos, [
      { id: 'plano', campos: ['planId'] },
      { id: 'company', campos: CAMPOS_DA_ABA_GERAL },
      { id: 'address', campos: CAMPOS_DA_ABA_ENDERECO },
    ]) ?? 'admin'
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!validate()) return

  saving.value = true
  try {
    await signUp({
      ...form.value,
      planId: planId.value,
      privacyAccepted: true,
      adminName: adminForm.value.name,
      adminEmail: adminForm.value.email,
      adminPassword: adminForm.value.password,
    })
    toastSuccess('Empresa cadastrada. Entre com o e-mail e a senha que você acabou de criar.')
    router.push({ name: 'login' })
  } catch (error) {
    const resolved = resolveFormError(error, 'Não foi possível concluir o cadastro')
    fieldErrors.value = resolved.fieldErrors
    errorMessage.value = Object.keys(resolved.fieldErrors).length ? '' : resolved.message
    focarAbaComErro()
  } finally {
    saving.value = false
  }
}

onMounted(carregarPlanos)
</script>

<template>
  <AuthLayout size="lg">
    <div class="mb-5 space-y-1">
      <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">Criar conta da sua empresa</h2>
      <p class="text-sm text-gray-500 dark:text-gray-400">
        O teste não pede cartão. Você só decide se assina quando ele terminar.
      </p>
    </div>

    <FormTabs v-model="aba" :tabs="abas" aria-label="Etapas do cadastro" numbered />

    <p v-if="errorMessage" class="mb-4 text-sm text-red-600 dark:text-red-400">{{ errorMessage }}</p>

    <form class="space-y-5" novalidate @submit.prevent="handleSubmit">
      <div v-show="aba === 'plano'" class="space-y-4">
        <p v-if="loading" class="text-sm text-gray-500 dark:text-gray-400">Carregando planos...</p>
        <button
          v-for="plan in plans"
          :key="plan.id"
          type="button"
          class="flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors"
          :class="
            planId === plan.id
              ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
              : 'border-gray-200 hover:border-primary-300 dark:border-gray-700 dark:hover:border-primary-700'
          "
          @click="planId = plan.id"
        >
          <BadgeCheck
            :size="20"
            class="mt-0.5 shrink-0"
            :class="planId === plan.id ? 'text-primary-600 dark:text-primary-400' : 'text-gray-300 dark:text-gray-600'"
            aria-hidden="true"
          />
          <span class="flex-1">
            <span class="block font-semibold text-gray-900 dark:text-gray-100">
              {{ plan.trialDays }} dias grátis, depois {{ formatCurrency(plan.monthlyAmount) }} por mês
            </span>
            <span v-if="plan.description" class="mt-1 block text-sm text-gray-500 dark:text-gray-400">
              {{ plan.description }}
            </span>
          </span>
        </button>
        <p v-if="fieldErrors.planId" class="text-sm text-red-600 dark:text-red-400">{{ fieldErrors.planId }}</p>
      </div>

      <CompanyFormFields v-show="aba === 'company'" :form="form" :field-errors="fieldErrors" section="geral" />
      <CompanyFormFields
        v-show="aba === 'address'"
        :form="form"
        :field-errors="fieldErrors"
        section="endereco"
        :looking-up-cep="lookingUpCep"
      />

      <div v-show="aba === 'admin'" class="space-y-5">
        <p class="text-xs font-medium uppercase text-gray-500 dark:text-gray-400">Seu acesso de administrador</p>
        <div class="grid gap-4 sm:grid-cols-2">
          <BaseInput v-model="adminForm.name" label="Nome" :maxlength="LIMITES_TEXTO.nome" :error="fieldErrors.adminName" required />
          <BaseInput v-model="adminForm.email" type="email" label="E-mail" :maxlength="LIMITES_TEXTO.email" :error="fieldErrors.adminEmail" required />
          <BaseInput v-model="adminForm.password" type="password" label="Senha" :maxlength="LIMITES_TEXTO.senha" :error="fieldErrors.adminPassword" required />
          <BaseInput
            v-model="adminForm.passwordConfirm"
            type="password"
            label="Confirmar senha"
            :maxlength="LIMITES_TEXTO.senha"
            :error="fieldErrors.adminPasswordConfirm"
            required
          />
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Este será o acesso de administrador da empresa.
        </p>

        <div>
          <div class="flex items-start gap-2.5">
            <BaseCheckbox
              :checked="privacyAccepted"
              :invalid="!!fieldErrors.privacyAccepted"
              label="Concordo com o aviso de privacidade"
              class="mt-0.5"
              @toggle="privacyAccepted = !privacyAccepted"
            />
            <label class="cursor-pointer text-sm text-gray-600 dark:text-gray-300" @click="privacyAccepted = !privacyAccepted">
              Li e concordo com o
              <RouterLink
                :to="{ name: 'privacidade' }"
                target="_blank"
                class="text-primary-600 hover:underline dark:text-primary-400"
                @click.stop
              >aviso de privacidade</RouterLink>, que explica quais dados o sistema guarda, por quanto
              tempo e quais são os seus direitos.
            </label>
          </div>
          <p v-if="fieldErrors.privacyAccepted" class="mt-1.5 text-sm text-red-600 dark:text-red-400">
            {{ fieldErrors.privacyAccepted }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-2 pt-2 sm:flex-nowrap">
        <RouterLink :to="{ name: 'login' }" class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Já tenho conta
        </RouterLink>
        <div class="flex gap-2">
          <BaseButton v-if="aba !== 'plano'" variant="secondary" type="button" @click="aba = abas[abas.findIndex((item) => item.id === aba) - 1].id">
            Voltar
          </BaseButton>
          <BaseButton v-if="aba !== 'admin'" type="button" :disabled="aba === 'plano' && !planoEscolhido" @click="aba = abas[abas.findIndex((item) => item.id === aba) + 1].id">
            Continuar
          </BaseButton>
          <BaseButton v-else type="submit" :disabled="saving">
            {{ saving ? 'Criando...' : 'Criar conta' }}
          </BaseButton>
        </div>
      </div>
    </form>
  </AuthLayout>
</template>
