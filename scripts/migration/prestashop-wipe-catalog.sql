-- =============================================================================
-- PrestaShop 8 — VIDER TOUT LE CATALOGUE (produits, images, déclinaisons, stock)
-- =============================================================================
-- Quand le BO ne peut pas supprimer (CannotDeleteProductImageException).
--
-- CONSERVE : commandes, clients, catégories, configuration.
-- SUPPRIME : tous les produits et leurs liaisons en base.
--
-- ⚠️ SAUVEGARDE phpMyAdmin obligatoire avant exécution !
--
-- Après ce script :
--   1. hPanel → supprimer le contenu de img/p/ (fichiers orphelins, optionnel)
--   2. Réimporter les produits via Foot Shop → /admin/bbdbuy
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Images
DELETE FROM ps_product_attribute_image;
DELETE FROM ps_image_lang;
DELETE FROM ps_image_shop;
DELETE FROM ps_image;

-- Déclinaisons
DELETE FROM ps_product_attribute_combination;
DELETE FROM ps_product_attribute_lang;
DELETE FROM ps_product_attribute_shop;
DELETE FROM ps_product_attribute;

-- Liaisons produit
DELETE FROM ps_category_product;
DELETE FROM ps_feature_product;
DELETE FROM ps_product_tag;
DELETE FROM ps_product_sale;
DELETE FROM ps_product_group_reduction_cache;
DELETE FROM ps_product_carrier;
DELETE FROM ps_product_country_tax;
DELETE FROM ps_product_supplier;
DELETE FROM ps_product_download;
DELETE FROM ps_product_attachment;
DELETE FROM ps_specific_price WHERE id_product > 0;
DELETE FROM ps_stock_available WHERE id_product > 0;
DELETE FROM ps_cart_product;

-- Produits
DELETE FROM ps_product_lang;
DELETE FROM ps_product_shop;
DELETE FROM ps_product;

-- Tables optionnelles (ignorer l'erreur si la table n'existe pas)
-- DELETE FROM ps_search_index;
-- DELETE FROM ps_layered_product_attribute;
-- DELETE FROM ps_pack;

SET FOREIGN_KEY_CHECKS = 1;

-- Vérifications (doivent afficher 0)
SELECT COUNT(*) AS produits_restants FROM ps_product;
SELECT COUNT(*) AS images_restantes FROM ps_image;
