-- Row Level Security on every table in public, as 0_init did for its own: 1_products_stock_finance left these four open to
-- Supabase's PostgREST API (anyone with the anon key could read and write them), and Prisma creates _prisma_migrations
-- without it. No policies, on purpose: anon/authenticated get nothing. The API is not affected: it connects as the tables'
-- owner (postgres), and RLS doesn't apply to a table's owner unless FORCE ROW LEVEL SECURITY is set.
ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductComponent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinanceEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
