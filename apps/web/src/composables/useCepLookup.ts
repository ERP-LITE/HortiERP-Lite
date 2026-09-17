import { ref, watch, type Ref } from 'vue'
import { findAddressByCep } from '@/services/cepService'
import { isValidUf } from '@/lib/ufs'
import { toastSuccess } from '@/lib/alerts'

/** A parte do formulário que a consulta de CEP preenche. */
export interface EnderecoPreenchivel {
  postalCode: string
  street: string
  district: string
  city: string
  state: string
  complement?: string
}

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

/**
 * Duas guardas que não podem sumir: `sequencia` descarta a resposta atrasada de um CEP corrigido no
 * meio do caminho, e `ultimoConsultado` impede que abrir uma edição sobrescreva o endereço salvo.
 */
export function useCepLookup(form: Ref<EnderecoPreenchivel>, fieldErrors: Ref<Record<string, string>>) {
  const lookingUpCep = ref(false)
  let ultimoConsultado = ''
  let sequencia = 0

  /** Marca o CEP atual como já resolvido, sem consultar. Usado ao abrir a edição de uma empresa. */
  function marcarCepComoCarregado() {
    ultimoConsultado = apenasDigitos(form.value.postalCode)
  }

  async function consultar() {
    const cep = apenasDigitos(form.value.postalCode)
    if (cep.length !== 8 || cep === ultimoConsultado) return

    const minha = ++sequencia
    lookingUpCep.value = true
    try {
      const endereco = await findAddressByCep(cep)
      if (minha !== sequencia || apenasDigitos(form.value.postalCode) !== cep) return

      form.value.street = endereco.street
      form.value.district = endereco.district
      form.value.city = endereco.city
      form.value.state = isValidUf(endereco.state) ? endereco.state.toUpperCase() : ''
      if (endereco.complement && !form.value.complement) form.value.complement = endereco.complement
      ultimoConsultado = cep
      toastSuccess('Endereço preenchido pelo CEP')
    } catch (erro) {
      if (minha !== sequencia || apenasDigitos(form.value.postalCode) !== cep) return
      fieldErrors.value.postalCode = erro instanceof Error ? erro.message : 'Não foi possível consultar o CEP'
    } finally {
      if (minha === sequencia) lookingUpCep.value = false
    }
  }

  watch(
    () => form.value.postalCode,
    () => {
      delete fieldErrors.value.postalCode
      void consultar()
    },
  )

  return { lookingUpCep, marcarCepComoCarregado }
}
