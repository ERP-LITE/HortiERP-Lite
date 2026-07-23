import Swal from 'sweetalert2'

function isDarkMode() {
  return document.documentElement.classList.contains('dark')
}

function themeOptions() {
  return isDarkMode() ? { background: '#1f2937', color: '#f3f4f6' } : {}
}

export async function confirmDelete(options: { title: string; text?: string }) {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Excluir',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    reverseButtons: true,
    ...themeOptions(),
  })

  return result.isConfirmed
}

export function toastSuccess(message: string) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title: message,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    ...themeOptions(),
  })
}

export function toastError(message: string) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'error',
    title: message,
    showConfirmButton: false,
    timer: 3500,
    timerProgressBar: true,
    ...themeOptions(),
  })
}
