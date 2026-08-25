-- Registro criado pelo suporte durante impersonação aponta para um usuário da empresa da Plataforma,
-- que a política por empresa esconde — a coluna "Registrado por" ficava vazia na tela da empresa.
-- Só SELECT e só super_admin: a linha exposta é de operador da plataforma, não de cliente.
CREATE POLICY "users_autor_da_plataforma" ON "users"
  FOR SELECT
  USING ("role" = 'super_admin');