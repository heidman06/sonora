# Sécurité

## Signaler une vulnérabilité

Contact : Reda (voir le profil GitHub du mainteneur). Ne pas ouvrir d issue publique pour une faille non corrigée.

## Modèle de menace

- Sonora est prévu pour un usage auto-hébergé derrière un VPN/tailnet ou un reverse proxy authentifié.
- Ne pas exposer /subsonic/rest sur Internet sans HTTPS + contrôle d accès.
- Les mots de passe sont stockés en scrypt (sel aléatoire). Sessions TTL 30 jours, révoquées au logout.
- Les cookies YouTube (data/yt-cookies.txt) donnent accès au compte Google utilisé : chmod 600, jamais committés.
- La passerelle Subsonic accepte l auth legacy (mot de passe en clair dans l URL) : à réserver au réseau local/VPN ; auth token MD5 optionnelle via SONORA_SONIC_USERS.
- Aucune télémétrie, aucun appel externe hors YouTube/Piped configurés.

## Bonnes pratiques

- Changer les mots de passe par défaut avant exposition.
- Sauvegarder data/ (SQLite WAL + cookies + cache audio).
- Mettre à jour yt-dlp régulièrement (les cookies expirent).
