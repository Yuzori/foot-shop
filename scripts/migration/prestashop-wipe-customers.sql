-- =============================================================================
-- PrestaShop 8 — Supprimer tous les comptes clients (tests)
-- =============================================================================
-- Supprime : clients, adresses, paniers, commandes liées, sessions.
-- CONSERVE : catalogue, catégories, configuration, comptes admin BO.
--
-- ⚠️ Sauvegarde BDD obligatoire avant exécution (phpMyAdmin → Exporter).
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Paniers
DELETE FROM ps_cart_product;
DELETE FROM ps_cart_cart_rule;
DELETE FROM ps_cart;

-- Commandes (liées aux clients test)
DELETE FROM ps_order_detail_tax;
DELETE FROM ps_order_detail;
DELETE FROM ps_order_history;
DELETE FROM ps_order_invoice_tax;
DELETE FROM ps_order_invoice_payment;
DELETE FROM ps_order_invoice;
DELETE FROM ps_order_payment;
DELETE FROM ps_order_carrier;
DELETE FROM ps_order_cart_rule;
DELETE FROM ps_order_slip_detail;
DELETE FROM ps_order_slip;
DELETE FROM ps_message;
DELETE FROM ps_order_return_detail;
DELETE FROM ps_order_return;
DELETE FROM ps_orders;

-- Adresses & clients
DELETE FROM ps_address;
DELETE FROM ps_customer_group;
DELETE FROM ps_customer_session;
DELETE FROM ps_customer_message;
DELETE FROM ps_emailsubscription;
DELETE FROM ps_wishlist_product;
DELETE FROM ps_wishlist;
DELETE FROM ps_customer;

-- Invités (sessions anonymes)
DELETE FROM ps_guest;

SET FOREIGN_KEY_CHECKS = 1;

-- Vérification
SELECT COUNT(*) AS clients_restants FROM ps_customer;
SELECT COUNT(*) AS commandes_restantes FROM ps_orders;
