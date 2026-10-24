-- ============================================================
--  Budget Foyer — Schéma de la base MySQL
--  À exécuter une seule fois dans phpMyAdmin (ou via le terminal)
--  de ton serveur WAMP.
--
--  Cette table générique (clef -> valeur JSON) stocke toutes les
--  données que tu saisis toi-même :
--    'ops'          : tes opérations ajoutées (revenus / dépenses)
--    'custom_cats'  : tes catégories de dépenses personnalisées
--    'custom_src'   : tes sources de revenus personnalisées
--    'subcats'      : tes sous-catégories
--
--  Les données de référence 2026 restent dans le fichier data.js.
-- ============================================================

CREATE DATABASE IF NOT EXISTS budget
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE budget;

CREATE TABLE IF NOT EXISTS kv (
  k          VARCHAR(64)  NOT NULL PRIMARY KEY,   -- ex. 'ops', 'custom_cats'…
  v          MEDIUMTEXT   NOT NULL,               -- contenu JSON
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
             ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
