<script setup lang="ts">
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import { ufOptions } from '@/lib/ufs'
import { LIMITES_TEXTO } from '@/lib/limits'
import type { CompanyFormValues } from '@/lib/companyForm'

/** `form` é mutado direto: com catorze campos, um evento por campo só duplicaria a escrita. */
defineProps<{
  form: CompanyFormValues
  fieldErrors: Record<string, string>
  section: 'geral' | 'endereco'
  lookingUpCep?: boolean
}>()
</script>

<template>
  <div v-if="section === 'geral'" class="space-y-5">
    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Identificação</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput v-model="form.name" label="Nome fantasia" :maxlength="LIMITES_TEXTO.razaoSocial" :error="fieldErrors.name" required />
      <BaseInput v-model="form.legalName" label="Razão social" :maxlength="LIMITES_TEXTO.razaoSocial" :error="fieldErrors.legalName" required />
      <BaseInput v-model="form.document" mask="cnpj" label="CNPJ" placeholder="00.000.000/0000-00" :error="fieldErrors.document" required />
      <BaseInput v-model="form.stateRegistration" label="Inscrição estadual (opcional)" :maxlength="LIMITES_TEXTO.inscricaoEstadual" :error="fieldErrors.stateRegistration" />
    </div>
    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contato</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <BaseInput v-model="form.contactName" label="Responsável" :maxlength="LIMITES_TEXTO.nome" :error="fieldErrors.contactName" required />
      <BaseInput v-model="form.contactEmail" type="email" label="E-mail de contato" :maxlength="LIMITES_TEXTO.email" :error="fieldErrors.contactEmail" required />
      <BaseInput v-model="form.phone" mask="phone" label="Telefone / WhatsApp" placeholder="(00) 00000-0000" :error="fieldErrors.phone" required />
    </div>
  </div>

  <div v-else class="space-y-5">
    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Endereço</p>
    <div class="grid gap-4 sm:grid-cols-2">
      <div>
        <BaseInput v-model="form.postalCode" mask="cep" label="CEP" placeholder="00000-000" :error="fieldErrors.postalCode" required />
        <span v-if="lookingUpCep" class="mt-1 block text-xs text-gray-500 dark:text-gray-400">Buscando endereço...</span>
      </div>
      <BaseInput v-model="form.street" label="Logradouro" :maxlength="LIMITES_TEXTO.endereco" :error="fieldErrors.street" required />
      <BaseInput v-model="form.addressNumber" label="Número" :maxlength="LIMITES_TEXTO.numeroEndereco" :error="fieldErrors.addressNumber" required />
      <BaseInput v-model="form.complement" label="Complemento (opcional)" :maxlength="LIMITES_TEXTO.complemento" :error="fieldErrors.complement" />
      <BaseInput v-model="form.district" label="Bairro" :maxlength="LIMITES_TEXTO.endereco" :error="fieldErrors.district" required />
      <BaseInput v-model="form.city" label="Cidade" :maxlength="LIMITES_TEXTO.endereco" :error="fieldErrors.city" required />
      <BaseSelect v-model="form.state" label="UF" :options="ufOptions" placeholder="Selecione a UF" :error="fieldErrors.state" required />
    </div>
  </div>
</template>
