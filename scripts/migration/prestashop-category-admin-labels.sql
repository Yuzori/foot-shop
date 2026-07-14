-- =============================================================================
-- PrestaShop — Libellés admin (optionnel)
-- =============================================================================
-- Le Studio maillot (/admin/bbdbuy) affiche déjà « Parent — Division » dans
-- les menus sans toucher au site. N'exécutez ce script que si vous voulez aussi
-- des noms distincts dans le back-office PrestaShop (BO → Catalogue → Catégories).
--
-- ⚠️ Les noms ci-dessous apparaîtront aussi sur le site si votre thème les
-- affiche tels quels. Préférez le sélecteur à 2 niveaux du Studio maillot.
-- =============================================================================

SET @id_lang = 1;

-- Exemple : renommer en BO uniquement via meta_title (selon thème, peut rester invisible front)
-- UPDATE ps_category_lang SET meta_title = CONCAT('Maillots — ', name)
-- WHERE id_category IN (SELECT id FROM ...) AND id_lang = @id_lang;

-- Pour recréer l'arborescence complète, utilisez plutôt :
--   scripts/migration/prestashop-create-divisions.sql

SELECT c.id_category, cl.name, c.id_parent, p.name AS parent_name
FROM ps_category c
JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang
LEFT JOIN ps_category_lang p ON p.id_category = c.id_parent AND p.id_lang = @id_lang
WHERE c.active = 1 AND c.id_category NOT IN (1, 2)
ORDER BY c.id_parent, c.position, cl.name;
