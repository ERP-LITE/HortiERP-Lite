-- Marca quando a senha mudou, para o token emitido antes disso deixar de valer. Sem isso, trocar a
-- senha não expulsa quem já estava dentro: o JWT antigo continua aceito até expirar (8h no padrão),
-- justamente na hora em que a pessoa troca a senha porque desconfia de invasão.
-- Nula nos usuários que já existem de propósito: nulo significa "nunca trocou", e assim subir esta
-- migration não desconecta todo mundo. A partir da primeira troca, a checagem passa a valer.
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;
