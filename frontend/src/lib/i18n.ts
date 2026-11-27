import type { Lang } from './types'

type Dict = Record<string, string>

const fr: Dict = {
  listen: 'Écouter', search: 'Rechercher', library: 'Bibliothèque', homeSubtitle: 'Ta musique. Tes mix.',
  yourMixes: 'Tes Mix', forYou: 'Pour toi', recent: 'Récemment écouté',
  exploreMoods: 'Explorer par envie', yourPlaylists: 'Tes playlists', seeAll: 'Tout voir',
  moodPhonk: 'Phonk', moodChill: 'Chill', moodRapFr: 'Rap FR', moodAfro: 'Afrobeats', moodFrenchTouch: 'French Touch', moodRnb: 'R&B', moodJazz: 'Jazz', moodElectro: 'Électro', moodNew: 'Nouveautés 2026', moodHitsFr: 'Top hits France', moodWorkout: 'Workout', moodDrive: 'Voiture', moodParty: 'Soirée', moodFocus: 'Concentration', moodRapUs: 'Rap US', moodIndie: 'Indé / Alternatif', moodHitsUs: 'Top hits US', moodReggaeton: 'Reggaeton', moodLatinPop: 'Pop latino', moodRockEs: 'Rock espagnol', moodHitsEs: 'Top hits latinos', becauseYouLike: 'Parce que tu aimes',
  signInTitle: 'Tes playlists, ici', signInBody: 'Connecte-toi avec ton compte Sonora pour retrouver tes playlists.',
  signIn: 'Se connecter', createAccount: 'Créer un compte', logout: 'Déconnexion',
  inviteCode: 'Code d’invitation', inviteCodeHint: 'Requis si les inscriptions sont protégées par un code.', inviteCodeInvalid: 'Code d’invitation requis ou invalide.',
  username: 'Nom d’utilisateur', password: 'Mot de passe', fillFields: 'Remplis les deux champs.',
  loggingIn: 'Connexion…', addAccount: 'Ajouter un compte', language: 'Langue', version: 'Version',
  favorites: 'Favoris', downloads: 'Téléchargements', myPlaylists: 'Mes playlists',
  noFavorites: 'Aucun favori pour l’instant.', noDownloads: 'Aucun téléchargement.', noPlaylists: 'Aucune playlist.',
  podcasts: 'Podcasts', podNew: 'Nouveaux épisodes', podDiscover: 'Découvrir', podCurated: 'Sélection', podImportUrl: 'Importer un flux RSS', podImportPlaceholder: 'https://…/flux.xml', podFollow: 'Suivre', podFollowing: 'Suivi', podUnfollow: 'Ne plus suivre', podEpisodes: 'épisodes', podEmpty: 'Aucun podcast suivi.', podEmptyHint: 'Découvre des shows ou importe un flux RSS.', podGuestTitle: 'Connecte-toi pour tes podcasts', podGuestHint: 'Abonnements et progression sont liés à ton compte.', podSearchPlaceholder: 'Rechercher un podcast…', podNoResults: 'Aucun résultat.', podRefresh: 'Rafraîchir', podStale: 'Hors ligne — dernière version connue.', podUnavailable: 'Indisponible', podResume: 'Reprendre', podCompleted: 'Écouté', podPublished: 'Publié', podAddUrl: 'Ajouter', podInvalidUrl: 'URL de flux invalide.', podUnsupportedFeed: 'Flux non supporté (Atom/JSON).', podTooLarge: 'Fichier trop volumineux.', podFetchError: 'Impossible de charger le flux.', podSeeAll: 'Tout voir', podRateHint: 'Vitesse jusqu’à 2× sur les épisodes.', podNewEmpty: 'Rien de nouveau pour l’instant.',
  addTracks: 'Ajouter des titres', playlistEmptyHint: 'Cette playlist est vide : ajoute des titres depuis la recherche.',
  searchTitle: 'Rechercher', searchSubtitle: 'Tout YouTube Music, en un geste.',
  searchGuestTitle: 'Connecte-toi pour chercher', searchGuestHint: 'La recherche passe par ton serveur : un compte Sonora est requis.',
  searchPlaceholder: 'Artistes, titres, albums…', searchHint: 'Cherche un artiste, un titre, une ambiance.',
  searchRecent: 'Recherches récentes', searchClear: 'Effacer',
  noResults: 'Aucun résultat.', all: 'Titres', videos: 'Vidéos', albums: 'Albums', artists: 'Artistes',
  loadMore: 'Charger plus', queue: 'File d’attente', addToPlaylist: 'Ajouter à une playlist',
  newPlaylist: 'Nouvelle playlist…', create: 'Créer', play: 'Lecture', pause: 'Pause',
  shuffle: 'Aléatoire', repeat: 'Répéter', close: 'Fermer', volume: 'Volume',
  mute: 'Couper le son', unmute: 'Rétablir le son', remaining: 'Restant',
  download: 'Télécharger', downloaded: 'Téléchargé ✓', unavailable: 'Lecture impossible',
  tracks: 'titres', playlists: 'listes', likedSongs: 'Titres que tu aimes',
  mixesGuestTitle: 'Connecte-toi pour tes mixes', mixesGuestHint: 'Mixes du jour, moods et favoris sont personnalisés par compte.',
  mixesEmpty: 'Écoute quelques titres pour créer tes Mix.', forYouEmpty: 'Écoute quelques titres, cette rangée suivra tes goûts.',
  basedOn: 'd’après ', mix: 'Mix', dailyMix: 'Mix du jour', addAccountTitle: 'Ajouter un compte',
  oneAccount: 'Un compte par personne, chacun ses playlists et son historique.',
  noSession: 'Connecte-toi pour retrouver ta musique.', error: 'Erreur.', loading: 'Chargement…',
  tracksCount: 'titres', playlistTracks: 'titres', remove: 'Retirer', delete: 'Supprimer',
  accountPlaylists: 'playlists', searchSongs: 'Titres', noDownloadsHint: 'Télécharge un titre depuis le lecteur.',
  sessionExpired: 'Session expirée, reconnecte-toi.', createPlaylistTitle: 'Nouvelle playlist',
  addToPlaylistEmpty: 'Crée une playlist pour ranger ce titre.', settings: 'Réglages',
  edit: 'Modifier', cancel: 'Annuler', confirm: 'Confirmer', noPlaylistsHint: 'Crée ta première playlist.',
  noFavoritesHint: 'Aime un titre pour le retrouver ici.', offlineHint: 'Connecte-toi à Internet pour rechercher.', lyricsHint: 'Les paroles proviennent de lrclib.',
  liked: 'Favori', unliked: 'Retiré des favoris', nowPlaying: 'En lecture',
  toastAdded: 'Ajouté ✓', toastFavNotSaved: 'Favori non enregistré', toastPlaybackImpossible: 'Lecture impossible',
  toastTapPlay: 'Appuie sur lecture', toastReconnecting: 'Reconnexion…', toastUnavailableNext: 'Titre indisponible — suivant',
  toastDownloaded: 'Téléchargé ✓', toastDownloadImpossible: 'Téléchargement impossible', toastRemoved: 'Supprimé', toastTrackNotFound: 'Titre introuvable',
  prev: 'Précédent', next: 'Suivant', progression: 'Progression', moveUp: 'Monter', moveDown: 'Descendre',
  queueEmpty: 'File vide', notInterested: 'Pas intéressé', searchError: 'Recherche indisponible. Vérifie ta connexion.', retry: 'Réessayer',
  seedFavorites: 'tes favoris', seedHistory: 'ton historique', seedPlaylists: 'tes playlists',
  footLike: 'Aimer', footAdd: 'Ajouter', footLyrics: 'Paroles', footSleep: 'Sommeil', footSpeed: 'Vitesse', footRadio: 'Radio', footSave: 'Offline',
  dlMissing: 'Copie hors ligne perdue : lance le titre pour la re-télécharger automatiquement.',
  mixDeco: 'Découvertes', mixBoucle: 'En boucle', mixFavoris: 'Tes favoris', mixArchives: 'Tes archives', mixRotation: 'Ta rotation', mixVrac: 'Tes playlists en vrac', mixDailyName: 'Mix du jour {n}', mixMoodName: 'Mix {mood}', mixDecoSub: 'Nouveaux titres selon tes goûts', mixBoucleSub: 'Ce que tu réécoutes le plus', mixFavorisSub: 'Tes titres likés, en aléatoire', mixArchivesSub: 'Tes écoutes d’il y a plus de 90 jours', mixColdSub: 'Mixes génériques pour commencer', seedRotation: 'ton historique', seedBulk: 'tes playlists',
  errorTitle: 'Un souci est survenu', errorUnknown: 'Erreur inconnue', reload: 'Recharger',
  loginError: 'Identifiants incorrects.', registerUsername: 'Nom invalide (3–24 caractères : a-z, 0-9, . _ -).',
  registerPassword: 'Mot de passe trop court (8 caractères minimum).', registerTaken: 'Nom déjà pris.',
  volumeIos: 'Volume : boutons physiques sur iOS', back: 'Retour', clearQueue: 'Vider la file', saveQueue: 'Enregistrer comme playlist',
  showMore: 'Afficher plus', offlineBanner: 'Hors ligne — données du cache', playNext: 'Lire ensuite', addToQueue: 'Ajouter à la file',
  menu: 'Plus d’actions', importYouTube: 'Importer une playlist YouTube', importHint: 'Colle un lien YouTube, Spotify, Apple Music ou Deezer…', installApp: 'Installer l’application', filterPlaylists: 'Filtrer les playlists…', sortBy: 'Trier', sortRecent: 'Récents', sortName: 'Nom', importTitle: 'Importer une playlist', importUrl: 'Lien', importCsv: 'CSV', importPreview: 'Aperçu', importApply: 'Importer', importCsvHint: 'Colle un export CSV (Exportify, Spotify…)',
  truncated: 'Playlist tronquée à 100 titres par YouTube.', exportM3U: 'Exporter M3U', exportJSON: 'Exporter JSON', rename: 'Renommer',
  likedView: 'Titres que tu aimes', filterLikes: 'Filtrer tes favoris…', shufflePlay: 'Lecture aléatoire', localResults: 'Dans ta bibliothèque', theme: 'Thème', seekBack: 'Reculer de 10 s', seekFwd: 'Avancer de 10 s', startRadio: 'Lancer la radio', lyrics: 'Paroles', lyricsUnavailable: 'Paroles indisponibles', lyricsInstrumental: 'Morceau instrumental', sleepTimer: 'Minuterie de sommeil', sleepOff: 'Off', sleepEnd: 'Fin du titre (≈)', sleepDone: 'Minuterie : pause', rate: 'Vitesse', rateHiddenIos: 'Vitesse indisponible en file iOS', updateReady: 'Nouvelle version prête', reloadNow: 'Recharger', resetApp: 'Réinitialiser l’app', crossfade: 'Fondu enchaîné', crossfadeOff: 'Off', crossfadeIos: 'Indisponible en lecture iOS (file HLS)', undo: 'Annuler', removed: 'Retiré', smartTop: 'Les plus écoutés', smartRecent: 'Ajouts récents', smartNever: 'Jamais écoutés', statsTitle: 'Statistiques', statsPlays: 'Écoutes', statsMinutes: 'Minutes', statsTracks: 'Titres', statsTopTracks: 'Top titres', statsTopArtists: 'Top artistes', statsPerMonth: 'Par mois', statsHonest: 'Minutes ≈ somme des durées des titres lancés (relances < 60 s dédupliquées)',
}

const en: Dict = {
  listen: 'Listen', search: 'Search', library: 'Library', homeSubtitle: 'Your music. Your mixes.',
  yourMixes: 'Your Mixes', forYou: 'For you', recent: 'Recently played',
  exploreMoods: 'Explore by mood', yourPlaylists: 'Your playlists', seeAll: 'See all',
  moodPhonk: 'Phonk', moodChill: 'Chill', moodRapFr: 'Rap FR', moodAfro: 'Afrobeats', moodFrenchTouch: 'French Touch', moodRnb: 'R&B', moodJazz: 'Jazz', moodElectro: 'Electro', moodNew: 'New in 2026', moodHitsFr: 'Top hits France', moodWorkout: 'Workout', moodDrive: 'Drive', moodParty: 'Party', moodFocus: 'Focus', moodRapUs: 'Rap / Hip-hop', moodIndie: 'Indie / Alternative', moodHitsUs: 'Top hits USA', moodReggaeton: 'Reggaeton', moodLatinPop: 'Latin pop', moodRockEs: 'Spanish rock', moodHitsEs: 'Top Latin hits', becauseYouLike: 'Because you like',
  signInTitle: 'Your playlists, here', signInBody: 'Sign in with your Sonora account to find your playlists.',
  signIn: 'Sign in', createAccount: 'Create account', logout: 'Sign out',
  inviteCode: 'Invitation code', inviteCodeHint: 'Required when sign-ups are protected by a code.', inviteCodeInvalid: 'Invitation code required or invalid.',
  username: 'Username', password: 'Password', fillFields: 'Fill in both fields.',
  loggingIn: 'Signing in…', addAccount: 'Add account', language: 'Language', version: 'Version',
  favorites: 'Favorites', downloads: 'Downloads', myPlaylists: 'My playlists',
  noFavorites: 'No favorites yet.', noDownloads: 'No downloads.', noPlaylists: 'No playlist.',
  podcasts: 'Podcasts', podNew: 'New episodes', podDiscover: 'Discover', podCurated: 'Curated', podImportUrl: 'Import an RSS feed', podImportPlaceholder: 'https://…/feed.xml', podFollow: 'Follow', podFollowing: 'Following', podUnfollow: 'Unfollow', podEpisodes: 'episodes', podEmpty: 'No podcasts followed.', podEmptyHint: 'Discover shows or import an RSS feed.', podGuestTitle: 'Sign in for your podcasts', podGuestHint: 'Subscriptions and progress are tied to your account.', podSearchPlaceholder: 'Search a podcast…', podNoResults: 'No results.', podRefresh: 'Refresh', podStale: 'Offline — last known version.', podUnavailable: 'Unavailable', podResume: 'Resume', podCompleted: 'Listened', podPublished: 'Published', podAddUrl: 'Add', podInvalidUrl: 'Invalid feed URL.', podUnsupportedFeed: 'Unsupported feed (Atom/JSON).', podTooLarge: 'File too large.', podFetchError: 'Could not load the feed.', podSeeAll: 'See all', podRateHint: 'Speed up to 2× on episodes.', podNewEmpty: 'Nothing new for now.',
  addTracks: 'Add tracks', playlistEmptyHint: 'This playlist is empty: add tracks from search.',
  searchTitle: 'Search', searchSubtitle: 'All of YouTube Music, in one gesture.',
  searchGuestTitle: 'Sign in to search', searchGuestHint: 'Search goes through your server: a Sonora account is required.',
  searchPlaceholder: 'Artists, songs, albums…', searchHint: 'Search for an artist, a track, a mood.',
  searchRecent: 'Recent searches', searchClear: 'Clear',
  noResults: 'No results.', all: 'Songs', videos: 'Videos', albums: 'Albums', artists: 'Artists',
  loadMore: 'Load more', queue: 'Queue', addToPlaylist: 'Add to playlist',
  newPlaylist: 'New playlist…', create: 'Create', play: 'Play', pause: 'Pause',
  shuffle: 'Shuffle', repeat: 'Repeat', close: 'Close', volume: 'Volume',
  mute: 'Mute', unmute: 'Unmute', remaining: 'Remaining',
  download: 'Download', downloaded: 'Downloaded ✓', unavailable: 'Cannot play this track',
  tracks: 'tracks', playlists: 'playlists', likedSongs: 'Liked songs',
  mixesGuestTitle: 'Sign in to get your mixes', mixesGuestHint: 'Daily mixes, moods and favorites are personalized per account.',
  mixesEmpty: 'Listen to a few tracks to create your Mixes.', forYouEmpty: 'Listen to a few tracks and this row will follow your taste.',
  basedOn: 'based on ', mix: 'Mix', dailyMix: 'Daily mix', addAccountTitle: 'Add account',
  oneAccount: 'One account per person, each with their own playlists and history.',
  noSession: 'Sign in to find your music.', error: 'Error.', loading: 'Loading…',
  tracksCount: 'tracks', playlistTracks: 'tracks', remove: 'Remove', delete: 'Delete',
  accountPlaylists: 'playlists', searchSongs: 'Songs', noDownloadsHint: 'Download a track from the player.',
  sessionExpired: 'Session expired, sign in again.', createPlaylistTitle: 'New playlist',
  addToPlaylistEmpty: 'Create a playlist to save this track.', settings: 'Settings',
  edit: 'Edit', cancel: 'Cancel', confirm: 'Confirm', noPlaylistsHint: 'Create your first playlist.',
  noFavoritesHint: 'Like a track to find it here.', offlineHint: 'Connect to the Internet to search.', lyricsHint: 'Lyrics come from lrclib.',
  liked: 'Favorite', unliked: 'Removed from favorites', nowPlaying: 'Now playing',
  toastAdded: 'Added ✓', toastFavNotSaved: 'Favorite not saved', toastPlaybackImpossible: 'Cannot play',
  toastTapPlay: 'Tap play', toastReconnecting: 'Reconnecting…', toastUnavailableNext: 'Track unavailable — skipping',
  toastDownloaded: 'Downloaded ✓', toastDownloadImpossible: 'Download failed', toastRemoved: 'Removed', toastTrackNotFound: 'Track not found',
  prev: 'Previous', next: 'Next', progression: 'Progress', moveUp: 'Move up', moveDown: 'Move down',
  queueEmpty: 'Queue empty', notInterested: 'Not interested', searchError: 'Search unavailable. Check your connection.', retry: 'Retry',
  seedFavorites: 'your favorites', seedHistory: 'your history', seedPlaylists: 'your playlists',
  footLike: 'Like', footAdd: 'Add', footLyrics: 'Lyrics', footSleep: 'Sleep', footSpeed: 'Speed', footRadio: 'Radio', footSave: 'Save',
  dlMissing: 'Offline copy lost: play the track to re-download it automatically.',
  mixDeco: 'Discoveries', mixBoucle: 'On repeat', mixFavoris: 'Your favorites', mixArchives: 'Your archives', mixRotation: 'Your rotation', mixVrac: 'Your playlists shuffled', mixDailyName: 'Daily mix {n}', mixMoodName: '{mood} mix', mixDecoSub: 'New tracks for your taste', mixBoucleSub: 'What you replay the most', mixFavorisSub: 'Your liked tracks, shuffled', mixArchivesSub: 'Your listens from over 90 days ago', mixColdSub: 'Generic mixes to get you started', seedRotation: 'your history', seedBulk: 'your playlists',
  errorTitle: 'Something went wrong', errorUnknown: 'Unknown error', reload: 'Reload',
  loginError: 'Wrong username or password.', registerUsername: 'Invalid name (3–24 chars: a-z, 0-9, . _ -).',
  registerPassword: 'Password too short (8 characters minimum).', registerTaken: 'Name already taken.',
  volumeIos: 'Volume: physical buttons on iOS', back: 'Back', clearQueue: 'Clear queue', saveQueue: 'Save as playlist',
  showMore: 'Show more', offlineBanner: 'Offline — cached data', playNext: 'Play next', addToQueue: 'Add to queue',
  menu: 'More actions', importYouTube: 'Import a YouTube playlist', importHint: 'Paste a YouTube, Spotify, Apple Music or Deezer link…', installApp: 'Install app', filterPlaylists: 'Filter playlists…', sortBy: 'Sort', sortRecent: 'Recent', sortName: 'Name', importTitle: 'Import a playlist', importUrl: 'Link', importCsv: 'CSV', importPreview: 'Preview', importApply: 'Import', importCsvHint: 'Paste a CSV export (Exportify, Spotify…)',
  truncated: 'Playlist truncated to 100 tracks by YouTube.', exportM3U: 'Export M3U', exportJSON: 'Export JSON', rename: 'Rename',
  likedView: 'Liked songs', filterLikes: 'Filter your favorites…', shufflePlay: 'Shuffle play', localResults: 'In your library', theme: 'Theme', seekBack: 'Back 10 s', seekFwd: 'Forward 10 s', startRadio: 'Start radio', lyrics: 'Lyrics', lyricsUnavailable: 'Lyrics unavailable', lyricsInstrumental: 'Instrumental track', sleepTimer: 'Sleep timer', sleepOff: 'Off', sleepEnd: 'End of track (≈)', sleepDone: 'Sleep timer: paused', rate: 'Speed', rateHiddenIos: 'Speed unavailable in iOS queue', updateReady: 'New version ready', reloadNow: 'Reload', resetApp: 'Reset app', crossfade: 'Crossfade', crossfadeOff: 'Off', crossfadeIos: 'Unavailable in iOS playback (HLS queue)', undo: 'Undo', removed: 'Removed', smartTop: 'Most played', smartRecent: 'Recently added', smartNever: 'Never played', statsTitle: 'Statistics', statsPlays: 'Plays', statsMinutes: 'Minutes', statsTracks: 'Tracks', statsTopTracks: 'Top tracks', statsTopArtists: 'Top artists', statsPerMonth: 'Per month', statsHonest: 'Minutes ≈ sum of durations of started tracks (replays < 60 s deduped)',
}

const es: Dict = {
  listen: 'Escuchar', search: 'Buscar', library: 'Biblioteca', homeSubtitle: 'Tu música. Tus mixes.',
  yourMixes: 'Tus Mix', forYou: 'Para ti', recent: 'Escuchado hace poco',
  exploreMoods: 'Explora por gusto', yourPlaylists: 'Tus listas', seeAll: 'Ver todo',
  moodPhonk: 'Phonk', moodChill: 'Relax', moodRapFr: 'Rap FR', moodAfro: 'Afrobeats', moodFrenchTouch: 'French Touch', moodRnb: 'R&B', moodJazz: 'Jazz', moodElectro: 'Electrónica', moodNew: 'Novedades 2026', moodHitsFr: 'Top hits Francia', moodWorkout: 'Entrenamiento', moodDrive: 'Coche', moodParty: 'Fiesta', moodFocus: 'Concentración', moodRapUs: 'Rap US', moodIndie: 'Indie / Alternativo', moodHitsUs: 'Top hits EE. UU.', moodReggaeton: 'Reguetón', moodLatinPop: 'Pop latino', moodRockEs: 'Rock en español', moodHitsEs: 'Top éxitos latinos', becauseYouLike: 'Porque te gusta',
  signInTitle: 'Tus listas, aquí', signInBody: 'Inicia sesión con tu cuenta Sonora para recuperar tus listas.',
  signIn: 'Iniciar sesión', createAccount: 'Crear una cuenta', logout: 'Cerrar sesión',
  inviteCode: 'Código de invitación', inviteCodeHint: 'Necesario cuando las inscripciones están protegidas por un código.', inviteCodeInvalid: 'Código de invitación requerido o inválido.',
  username: 'Usuario', password: 'Contraseña', fillFields: 'Rellena los dos campos.',
  loggingIn: 'Conectando…', addAccount: 'Añadir cuenta', language: 'Idioma', version: 'Versión',
  favorites: 'Favoritos', downloads: 'Descargas', myPlaylists: 'Mis listas',
  noFavorites: 'Aún no hay favoritos.', noDownloads: 'Ninguna descarga.', noPlaylists: 'Ninguna lista.',
  podcasts: 'Podcasts', podNew: 'Nuevos episodios', podDiscover: 'Descubrir', podCurated: 'Selección', podImportUrl: 'Importar un feed RSS', podImportPlaceholder: 'https://…/rss.xml', podFollow: 'Seguir', podFollowing: 'Siguiendo', podUnfollow: 'Dejar de seguir', podEpisodes: 'episodios', podEmpty: 'Ningún podcast seguido.', podEmptyHint: 'Descubre shows o importa un feed RSS.', podGuestTitle: 'Inicia sesión para tus podcasts', podGuestHint: 'Las suscripciones y el progreso están ligados a tu cuenta.', podSearchPlaceholder: 'Buscar un podcast…', podNoResults: 'Sin resultados.', podRefresh: 'Actualizar', podStale: 'Sin conexión — última versión conocida.', podUnavailable: 'No disponible', podResume: 'Reanudar', podCompleted: 'Escuchado', podPublished: 'Publicado', podAddUrl: 'Añadir', podInvalidUrl: 'URL de feed inválida.', podUnsupportedFeed: 'Feed no soportado (Atom/JSON).', podTooLarge: 'Archivo demasiado grande.', podFetchError: 'No se pudo cargar el feed.', podSeeAll: 'Ver todo', podRateHint: 'Velocidad hasta 2× en episodios.', podNewEmpty: 'Nada nuevo por ahora.',
  addTracks: 'Añadir títulos', playlistEmptyHint: 'Esta lista está vacía: añade títulos desde la búsqueda.',
  searchTitle: 'Buscar', searchSubtitle: 'Todo YouTube Music, en un gesto.',
  searchGuestTitle: 'Inicia sesión para buscar', searchGuestHint: 'La búsqueda pasa por tu servidor: se requiere una cuenta Sonora.',
  searchPlaceholder: 'Artistas, canciones, álbumes…', searchHint: 'Busca un artista, una canción, un ambiente.',
  searchRecent: 'Búsquedas recientes', searchClear: 'Borrar',
  noResults: 'Sin resultados.', all: 'Canciones', videos: 'Vídeos', albums: 'Álbumes', artists: 'Artistas',
  loadMore: 'Cargar más', queue: 'Cola', addToPlaylist: 'Añadir a una lista',
  newPlaylist: 'Nueva lista…', create: 'Crear', play: 'Reproducir', pause: 'Pausa',
  shuffle: 'Aleatorio', repeat: 'Repetir', close: 'Cerrar', volume: 'Volumen',
  mute: 'Silenciar', unmute: 'Restaurar sonido', remaining: 'Restante',
  download: 'Descargar', downloaded: 'Descargado ✓', unavailable: 'No se puede reproducir',
  tracks: 'canciones', playlists: 'listas', likedSongs: 'Canciones que te gustan',
  mixesGuestTitle: 'Inicia sesión para tus mixes', mixesGuestHint: 'Los mixes diarios, moods y favoritos se personalizan por cuenta.',
  mixesEmpty: 'Escucha algunos títulos para crear tus Mix.', forYouEmpty: 'Escucha algunos títulos y esta fila seguirá tus gustos.',
  basedOn: 'según ', mix: 'Mix', dailyMix: 'Mix diario', addAccountTitle: 'Añadir cuenta',
  oneAccount: 'Una cuenta por persona, cada uno con sus listas e historial.',
  noSession: 'Inicia sesión para encontrar tu música.', error: 'Error.', loading: 'Cargando…',
  tracksCount: 'canciones', playlistTracks: 'canciones', remove: 'Quitar', delete: 'Eliminar',
  accountPlaylists: 'listas', searchSongs: 'Canciones', noDownloadsHint: 'Descarga un título desde el reproductor.',
  sessionExpired: 'Sesión caducada, vuelve a iniciar sesión.', createPlaylistTitle: 'Nueva lista',
  addToPlaylistEmpty: 'Crea una lista para guardar este título.', settings: 'Ajustes',
  edit: 'Editar', cancel: 'Cancelar', confirm: 'Confirmar', noPlaylistsHint: 'Crea tu primera lista.',
  noFavoritesHint: 'Marca un título como favorito para encontrarlo aquí.', offlineHint: 'Conéctate a Internet para buscar.', lyricsHint: 'Las letras proceden de lrclib.',
  liked: 'Favorito', unliked: 'Quitado de favoritos', nowPlaying: 'Reproduciendo',
  toastAdded: 'Añadido ✓', toastFavNotSaved: 'Favorito no guardado', toastPlaybackImpossible: 'No se puede reproducir',
  toastTapPlay: 'Pulsa reproducir', toastReconnecting: 'Reconectando…', toastUnavailableNext: 'Título no disponible — siguiente',
  toastDownloaded: 'Descargado ✓', toastDownloadImpossible: 'Descarga fallida', toastRemoved: 'Eliminado', toastTrackNotFound: 'Título no encontrado',
  prev: 'Anterior', next: 'Siguiente', progression: 'Progreso', moveUp: 'Subir', moveDown: 'Bajar',
  queueEmpty: 'Cola vacía', notInterested: 'No me interesa', searchError: 'Búsqueda no disponible. Revisa tu conexión.', retry: 'Reintentar',
  seedFavorites: 'tus favoritos', seedHistory: 'tu historial', seedPlaylists: 'tus listas',
  footLike: 'Gustar', footAdd: 'Añadir', footLyrics: 'Letras', footSleep: 'Sueño', footSpeed: 'Velocidad', footRadio: 'Radio', footSave: 'Guardar',
  dlMissing: 'Copia sin conexión perdida: reproduce el tema para volver a descargarlo automáticamente.',
  mixDeco: 'Descubrimientos', mixBoucle: 'En bucle', mixFavoris: 'Tus favoritos', mixArchives: 'Tus archivos', mixRotation: 'Tu rotación', mixVrac: 'Tus listas en bruto', mixDailyName: 'Mix diario {n}', mixMoodName: 'Mix {mood}', mixDecoSub: 'Nuevos temas según tu gusto', mixBoucleSub: 'Lo que más repites', mixFavorisSub: 'Tus temas favoritos, en aleatorio', mixArchivesSub: 'Tus escuchas de hace más de 90 días', mixColdSub: 'Mixes genéricos para empezar', seedRotation: 'tu historial', seedBulk: 'tus listas',
  errorTitle: 'Algo salió mal', errorUnknown: 'Error desconocido', reload: 'Recargar',
  loginError: 'Usuario o contraseña incorrectos.', registerUsername: 'Nombre inválido (3–24 caracteres: a-z, 0-9, . _ -).',
  registerPassword: 'Contraseña demasiado corta (mínimo 8 caracteres).', registerTaken: 'Nombre ya usado.',
  volumeIos: 'Volumen: botones físicos en iOS', back: 'Volver', clearQueue: 'Vaciar la cola', saveQueue: 'Guardar como lista',
  showMore: 'Mostrar más', offlineBanner: 'Sin conexión — datos de la caché', playNext: 'Reproducir a continuación', addToQueue: 'Añadir a la cola',
  menu: 'Más acciones', importYouTube: 'Importar una lista de YouTube', importHint: 'Pega un enlace de YouTube, Spotify, Apple Music o Deezer…', installApp: 'Instalar la app', filterPlaylists: 'Filtrar listas…', sortBy: 'Ordenar', sortRecent: 'Recientes', sortName: 'Nombre', importTitle: 'Importar una lista', importUrl: 'Enlace', importCsv: 'CSV', importPreview: 'Vista previa', importApply: 'Importar', importCsvHint: 'Pega un CSV (Exportify, Spotify…)',
  truncated: 'YouTube truncó la lista a 100 títulos.', exportM3U: 'Exportar M3U', exportJSON: 'Exportar JSON', rename: 'Renombrar',
  likedView: 'Canciones que te gustan', filterLikes: 'Filtra tus favoritos…', shufflePlay: 'Reproducción aleatoria', localResults: 'En tu biblioteca', theme: 'Tema', seekBack: 'Retroceder 10 s', seekFwd: 'Avanzar 10 s', startRadio: 'Iniciar radio', lyrics: 'Letras', lyricsUnavailable: 'Letras no disponibles', lyricsInstrumental: 'Tema instrumental', sleepTimer: 'Temporizador de sueño', sleepOff: 'Off', sleepEnd: 'Fin del título (≈)', sleepDone: 'Temporizador: pausa', rate: 'Velocidad', rateHiddenIos: 'Velocidad no disponible en cola iOS', updateReady: 'Nueva versión lista', reloadNow: 'Recargar', resetApp: 'Restablecer la app', crossfade: 'Fundido encadenado', crossfadeOff: 'Off', crossfadeIos: 'No disponible en reproducción iOS (cola HLS)', undo: 'Deshacer', removed: 'Quitado', smartTop: 'Más escuchados', smartRecent: 'Añadidos recientes', smartNever: 'Nunca escuchados', statsTitle: 'Estadísticas', statsPlays: 'Reproducciones', statsMinutes: 'Minutos', statsTracks: 'Títulos', statsTopTracks: 'Top títulos', statsTopArtists: 'Top artistas', statsPerMonth: 'Por mes', statsHonest: 'Minutos ≈ suma de duraciones de títulos lanzados (relances < 60 s deduplicados)',
}

export const DICTS: Record<Lang, Dict> = { fr, en, es }

export function tr(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const base = DICTS[lang]?.[key] ?? DICTS.en[key] ?? key
  if (!params) return base
  return base.replace(/\{(\w+)\}/g, (m, k: string) => (params[k] !== undefined ? String(params[k]) : m))
}

export function nextLang(lang: Lang): Lang {
  return lang === 'en' ? 'es' : lang === 'es' ? 'fr' : 'en'
}

export function langLabel(lang: Lang): string {
  return lang.toUpperCase()
}

export function hello(lang: Lang, date = new Date()): string {
  const h = date.getHours()
  if (lang === 'en') return h < 6 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  if (lang === 'es') return h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
  return h < 6 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bel après-midi' : 'Bonsoir'
}

export function dateLabel(lang: Lang, date = new Date()): string {
  const days = lang === 'fr'
    ? ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
    : lang === 'es'
      ? ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
      : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = lang === 'fr'
    ? ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre']
    : lang === 'es'
      ? ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
      : ['January','February','March','April','May','June','July','August','September','October','November','December']
  return days[date.getDay()] + ' ' + date.getDate() + ' ' + months[date.getMonth()]
}
