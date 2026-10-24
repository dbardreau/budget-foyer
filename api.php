<?php
/* ============================================================
   Budget Foyer — API PHP / MySQL
   Cette page est appelée par le site (app.js) pour lire et
   enregistrer tes données dans la base MySQL `budget`.

   Utilisation :
     GET  api.php                     -> renvoie toute la base (objet JSON)
     POST {action:'save', k, v}       -> enregistre la clef k avec la valeur v
     POST {action:'reset', k}         -> supprime la clef k
   ============================================================ */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

/* ---------- 1. Connexion à MySQL (à adapter si besoin) ----------
   WAMP par défaut : utilisateur "root" sans mot de passe, port 3306. */
$config = array(
  'host' => '127.0.0.1',
  'port' => 3306,
  'user' => 'root',
  'pass' => '',
  'db'   => 'budget',
);

try {
  $pdo = new PDO(
    "mysql:host={$config['host']};port={$config['port']};dbname={$config['db']};charset=utf8mb4",
    $config['user'],
    $config['pass'],
    array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
  );
} catch (PDOException $e) {
  http_response_code(500);
  echo json_encode(array('ok' => false, 'error' => 'connexion', 'msg' => $e->getMessage()));
  exit;
}

/* Crée automatiquement la table si elle n'existe pas encore
   (permet de démarrer sans avoir lancé budget.sql à la main). */
$pdo->exec("CREATE TABLE IF NOT EXISTS kv (
  k VARCHAR(64) NOT NULL PRIMARY KEY,
  v MEDIUMTEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$method = $_SERVER['REQUEST_METHOD'];

/* ---------- 2. Écriture (POST) ---------- */
if ($method === 'POST') {
  $raw = file_get_contents('php://input');
  $in  = json_decode($raw, true);
  if (!is_array($in)) $in = array();

  $action = isset($in['action']) ? $in['action'] : '';
  $key    = isset($in['k']) ? (string)$in['k'] : '';

  if ($action === 'save' && $key !== '' && array_key_exists('v', $in)) {
    $value = json_encode($in['v'], JSON_UNESCAPED_UNICODE);
    $stmt  = $pdo->prepare('INSERT INTO kv (k, v) VALUES (?, ?)
                            ON DUPLICATE KEY UPDATE v = VALUES(v)');
    $stmt->execute(array($key, $value));
    echo json_encode(array('ok' => true));
    exit;
  }

  if ($action === 'reset' && $key !== '') {
    $stmt = $pdo->prepare('DELETE FROM kv WHERE k = ?');
    $stmt->execute(array($key));
    echo json_encode(array('ok' => true));
    exit;
  }

  http_response_code(400);
  echo json_encode(array('ok' => false, 'error' => 'requête invalide'));
  exit;
}

/* ---------- 3. Lecture (GET) : renvoie toutes les données ---------- */
$out = new stdClass();
$rows = $pdo->query('SELECT k, v FROM kv')->fetchAll(PDO::FETCH_ASSOC);
foreach ($rows as $row) {
  $out->{$row['k']} = json_decode($row['v'], true);
}
echo json_encode($out, JSON_UNESCAPED_UNICODE);
