-- ADMIN-03: planModulesJson now gates the dashboard (menu + API 403). It held display labels ("Pedidos", …) or "[]";
-- every existing restaurant starts with all modules on, and so does every new one — the super admin turns them off.
ALTER TABLE "Restaurant" ALTER COLUMN "planModulesJson" SET DEFAULT '["pedidos","cardapio","mesas","promocoes","atendimento","produtos","relatorios","visao","pagar","receber","fiscal"]';
UPDATE "Restaurant" SET "planModulesJson" = '["pedidos","cardapio","mesas","promocoes","atendimento","produtos","relatorios","visao","pagar","receber","fiscal"]';
