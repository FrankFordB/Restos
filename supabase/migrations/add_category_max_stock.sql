-- Migración para agregar stock máximo global por categoría
-- Este campo permite al vendedor definir cuántas unidades en total puede vender de una categoría

alter table if exists public.product_categories
  add column if not exists max_stock integer null;

-- El campo current_stock trackeará cuántas unidades quedan disponibles
alter table if exists public.product_categories
  add column if not exists current_stock integer null;

-- Comentario: 
-- max_stock = stock máximo definido por el vendedor
-- current_stock = stock actual que se va restando con cada venta
-- Cuando current_stock llega a 0, la tienda se cierra automáticamente
