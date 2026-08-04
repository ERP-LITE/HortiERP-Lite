CREATE INDEX "stock_entries_company_entry_date_idx" ON "stock_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "stock_entry_items_entry_idx" ON "stock_entry_items" USING btree ("stock_entry_id");--> statement-breakpoint
CREATE INDEX "stock_entry_items_product_idx" ON "stock_entry_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "losses_company_loss_date_idx" ON "losses" USING btree ("company_id","loss_date");--> statement-breakpoint
CREATE INDEX "losses_company_product_idx" ON "losses" USING btree ("company_id","product_id");--> statement-breakpoint
CREATE INDEX "stock_movements_company_created_at_idx" ON "stock_movements" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_company_product_idx" ON "stock_movements" USING btree ("company_id","product_id");