# CarPlay avec Amperfy — guide de test

Sonora expose une passerelle **Subsonic** sur `/subsonic/rest`. Amperfy (App Store, gratuit) supporte CarPlay et sait parler Subsonic.

## Prérequis

- iPhone avec **Tailscale** actif (Sonora est tailnet-only)
- L'URL Sonora répond : ouvre `https://votre-domaine.tld:8451/musique/` sur le téléphone
- **Amperfy** installé (iOS 16+)

## Configuration

1. Amperfy → **Add Server** → type **Subsonic**
2. URL : `https://votre-domaine.tld:8451/subsonic`
3. Utilisateur : `heid` (ou `maria`)
4. Mot de passe : celui du compte Sonora
5. **Mode legacy** : activer l'option *legacy login* (Amperfy v1.0.7+) — la passerelle accepte aussi le token MD5 si `SONORA_SONIC_USERS` est défini côté serveur.

## Ce qui doit apparaître

- **Playlists** : les listes Sonora (mappées en albums côté Subsonic)
- **Albums** : les mêmes listes, triées par date
- **Artistes** : un artiste « Sonora » contenant ces albums
- **Favoris** : les titres likés (`getStarred2`)
- **Recherche** : recherche YouTube via yt-dlp (10 résultats)
- **Lecture** : stream m4a via `/musique/dl/`, pochettes, lecture arrière-plan/CarPlay

## Limites connues

- Les albums sont dérivés des playlists (pas de vraie notion d'album)
- Durées affichées à 0:00 (les fichiers n'ont pas de durée stockée)
- Podcasts / radios / genres : listes vides (non gérés par Sonora)
- Premier lancement d'un titre : quelques secondes (extraction serveur), puis cache
- **Validation sur autoradio réel non encore effectuée**

## Dépannage

| Problème | Piste |
|---|---|
| Erreur 40 « Wrong password » | vérifier identifiants, essayer `p` legacy ; compte sans token |
| Écran vide après login | `ping` doit répondre ; vérifier URL exacte `/subsonic` |
| Pochettes absentes | `getCoverArt` proxy i.ytimg.com ; vérifier accès réseau |
| Stream ne démarre pas | tester `/subsonic/rest/stream.view?...&id=VIDEOID` → doit renvoyer 302 |
| CarPlay absent | Amperfy doit être autorisé dans Réglages → Général → CarPlay |

## Test rapide en ligne de commande

```bash
PW='...'
B='https://votre-domaine.tld:8451/subsonic/rest'
curl -s "$B/ping.view?u=heid&p=$PW&v=1.16.1&c=test&f=json"
curl -s "$B/getPlaylists.view?u=heid&p=$PW&v=1.16.1&c=test&f=json"
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$B/stream.view?u=heid&p=$PW&v=1.16.1&c=test&id=mqgEYRtWMJU"
```
