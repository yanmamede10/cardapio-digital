-- RF-DESC-03: a "delivery" module. The customer app's restaurant list shows only active restaurants that have it, and only
-- they take delivery orders; the table QR, the tablet and the waiter don't depend on it. Every restaurant was listed until
-- now, so every one keeps it (the super admin turns it off per restaurant), and a new one gets it with every other module.
UPDATE "Restaurant" SET "planModulesJson" = ("planModulesJson"::jsonb || '["delivery"]'::jsonb)::text WHERE NOT ("planModulesJson"::jsonb ? 'delivery');
ALTER TABLE "Restaurant" ALTER COLUMN "planModulesJson" SET DEFAULT '["pedidos","cardapio","mesas","promocoes","atendimento","produtos","relatorios","visao","pagar","receber","fiscal","delivery"]';
