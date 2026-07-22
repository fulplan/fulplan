-- CreateIndex
CREATE INDEX "credit_entries_customerId_createdAt_idx" ON "credit_entries"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "sale_items_saleId_productId_idx" ON "sale_items"("saleId", "productId");

-- CreateIndex
CREATE INDEX "sales_organizationId_status_createdAt_idx" ON "sales"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "sales_organizationId_cashierId_createdAt_idx" ON "sales"("organizationId", "cashierId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_organizationId_customerId_idx" ON "sales"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "stock_movements_organizationId_productId_createdAt_idx" ON "stock_movements"("organizationId", "productId", "createdAt");
