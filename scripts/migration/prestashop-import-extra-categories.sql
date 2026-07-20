-- =============================================================================

-- PrestaShop 8 — Catégories import spéciales (Foot Shop)

--   • Le reste du monde

--   • Maillot Concept

--   • Maillot Retro

--

-- Créées sous « Maillots » si ce parent existe, sinon sous Accueil (2).

-- Après exécution : BO → Catalogue → Catégories → Reconstruire l'arborescence

-- Puis renseignez les IDs dans .env :

--   PRODUCT_IMPORT_RESTE_MONDE_CATEGORY_ID=

--   PRODUCT_IMPORT_MAILLOT_CONCEPT_CATEGORY_ID=

--   PRODUCT_IMPORT_MAILLOT_RETRO_CATEGORY_ID=

-- =============================================================================



SET @id_lang = 1;

SET @id_shop = 1;

SET @accueil = 2;



SELECT id_category INTO @maillots_parent

FROM ps_category_lang

WHERE id_lang = @id_lang AND name = 'Maillots'

LIMIT 1;



SET @parent = IFNULL(@maillots_parent, @accueil);



DROP PROCEDURE IF EXISTS footshop_add_category;



DELIMITER $$



CREATE PROCEDURE footshop_add_category(

  IN p_parent INT,

  IN p_name VARCHAR(128),

  IN p_rewrite VARCHAR(128),

  IN p_position INT

)

BEGIN

  INSERT INTO ps_category (

    id_parent, level_depth, nleft, nright, active, date_add, date_upd, position, is_root_category

  ) VALUES (

    p_parent, 0, 0, 0, 1, NOW(), NOW(), p_position, 0

  );

  SET @last_category_id = LAST_INSERT_ID();

  INSERT INTO ps_category_lang (id_category, id_shop, id_lang, name, link_rewrite, description, meta_title)

  VALUES (@last_category_id, @id_shop, @id_lang, p_name, p_rewrite, '', p_name);

  INSERT INTO ps_category_shop (id_category, id_shop, position)

  VALUES (@last_category_id, @id_shop, p_position);

END$$



DELIMITER ;



CALL footshop_add_category(@parent, 'Le reste du monde', 'le-reste-du-monde', 30);

SET @cat_reste_monde = @last_category_id;



CALL footshop_add_category(@parent, 'Maillot Concept', 'maillot-concept', 31);

SET @cat_maillot_concept = @last_category_id;



CALL footshop_add_category(@parent, 'Maillot Retro', 'maillot-retro', 32);

SET @cat_maillot_retro = @last_category_id;



DROP PROCEDURE IF EXISTS footshop_add_category;



SELECT @cat_reste_monde AS reste_du_monde_id,

       @cat_maillot_concept AS maillot_concept_id,

       @cat_maillot_retro AS maillot_retro_id;



-- Vérification

SELECT c.id_category, c.id_parent, cl.name, cl.link_rewrite

FROM ps_category c

JOIN ps_category_lang cl ON cl.id_category = c.id_category AND cl.id_lang = @id_lang

WHERE c.id_category IN (@cat_reste_monde, @cat_maillot_concept, @cat_maillot_retro);

