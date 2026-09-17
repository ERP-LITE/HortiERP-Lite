-- Margem alvo em percentual sobre o preço de venda, não sobre o custo. A diferença entre margem e
-- markup muda o preço sugerido, e o porquê está em docs/decisoes-arquiteturais.md.
-- Fica nos dois níveis: a categoria dá o padrão do grupo e o produto sobrescreve quando precisa.
ALTER TABLE "categories" ADD COLUMN "target_margin" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "target_margin" numeric(5, 2);--> statement-breakpoint
-- 100% é proibido junto com o resto: margem sobre venda igual a 100 zeraria o divisor do preço
-- sugerido, e acima disso não existe.
ALTER TABLE "categories" ADD CONSTRAINT "categories_target_margin_range"
  CHECK ("target_margin" IS NULL OR ("target_margin" >= 0 AND "target_margin" < 100));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_target_margin_range"
  CHECK ("target_margin" IS NULL OR ("target_margin" >= 0 AND "target_margin" < 100));
