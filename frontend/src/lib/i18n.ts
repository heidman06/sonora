import type { Lang } from './types'

type Dict = Record<string, string>

const fr: Dict = {
  listen: 'Écouter', search: 'Rechercher', library: 'Bibliothèque',
  yourMixes: 'Tes Mix', forYou: 'Pour toi', recent: 'Récemment écouté',
  exploreMoods: 'Explorer par envie', yourPlaylists: 'Tes playlists', seeAll: 'Tout voir',
  signInTitle: 'Tes playlists, ici', signInBody: 'Connecte-toi avec ton compte Sonora pour retrouver tes playlists.',
  signIn: 'Se connecter', createAccount: 'Créer un compte', logout: 'Déconnexion',
  username: 'Nom d’utilisateur', password: 'Mot de passe', fillFields: 'Remplis les deux champs.',
  loggingIn: 'Connexion…', addAccount: 'Ajouter un compte', language: 'Langue', version: 'Version',
  favorites: 'Favoris', downloads: 'Téléchargements', myPlaylists: 'Mes playlists',
  noFavorites: 'Aucun favori pour l’instant.', noDownloads: 'Aucun téléchargement.', noPlaylists: 'Aucune playlist.',
  searchTitle: 'Rechercher', searchSubtitle: 'Tout YouTube Music, en un geste.',
  searchPlaceholder: 'Artistes, titres, albums…', searchHint: 'Cherche un artiste, un titre, une ambiance.',
  noResults: 'Aucun résultat.', all: 'Titres', videos: 'Vidéos', albums: 'Albums', artists: 'Artistes',
  loadMore: 'Charger plus', queue: 'File d’attente', addToPlaylist: 'Ajouter à une playlist',
  newPlaylist: 'Nouvelle playlist…', create: 'Créer', play: 'Lecture', pause: 'Pause',
  shuffle: 'Aléatoire', repeat: 'Répéter', close: 'Fermer', volume: 'Volume',
  download: 'Télécharger', downloaded: 'Téléchargé ✓', unavailable: 'Lecture impossible',
  tracks: 'titres', playlists: 'listes', likedSongs: 'Titres que tu aimes',
  mixesEmpty: 'Écoute quelques titres pour créer tes Mix.', forYouEmpty: 'Écoute quelques titres, cette rangée suivra tes goûts.',
  basedOn: 'd’après ', mix: 'Mix', dailyMix: 'Mix du jour', addAccountTitle: 'Ajouter un compte',
  oneAccount: 'Un compte par personne, chacun ses playlists et son historique.',
  noSession: 'Connecte-toi pour retrouver ta musique.', error: 'Erreur.', loading: 'Chargement…',
  tracksCount: 'titres', playlistTracks: 'titres', remove: 'Retirer', delete: 'Supprimer',
  accountPlaylists: 'playlists', searchSongs: 'Titres', noDownloadsHint: 'Télécharge un titre depuis le lecteur.',
  sessionExpired: 'Session expirée, reconnecte-toi.', createPlaylistTitle: 'Nouvelle playlist',
  addToPlaylistEmpty: 'Crée une playlist pour ranger ce titre.', settings: 'Réglages',
  edit: 'Modifier', cancel: 'Annuler', confirm: 'Confirmer', noPlaylistsHint: 'Crée ta première playlist.',
  liked: 'Favori', unliked: 'Retiré des favoris', nowPlaying: 'En lecture',
}

const en: Dict = {
  listen: 'Listen', search: 'Search', library: 'Library',
  yourMixes: 'Your Mixes', forYou: 'For you', recent: 'Recently played',
  exploreMoods: 'Explore by mood', yourPlaylists: 'Your playlists', seeAll: 'See all',
  signInTitle: 'Your playlists, here', signInBody: 'Sign in with your Sonora account to find your playlists.',
  signIn: 'Sign in', createAccount: 'Create account', logout: 'Sign out',
  username: 'Username', password: 'Password', fillFields: 'Fill in both fields.',
  loggingIn: 'Signing in…', addAccount: 'Add account', language: 'Language', version: 'Version',
  favorites: 'Favorites', downloads: 'Downloads', myPlaylists: 'My playlists',
  noFavorites: 'No favorites yet.', noDownloads: 'No downloads.', noPlaylists: 'No playlist.',
  searchTitle: 'Search', searchSubtitle: 'All of YouTube Music, in one gesture.',
  searchPlaceholder: 'Artists, songs, albums…', searchHint: 'Search for an artist, a track, a mood.',
  noResults: 'No results.', all: 'Songs', videos: 'Videos', albums: 'Albums', artists: 'Artists',
  loadMore: 'Load more', queue: 'Queue', addToPlaylist: 'Add to playlist',
  newPlaylist: 'New playlist…', create: 'Create', play: 'Play', pause: 'Pause',
  shuffle: 'Shuffle', repeat: 'Repeat', close: 'Close', volume: 'Volume',
  download: 'Download', downloaded: 'Downloaded ✓', unavailable: 'Cannot play this track',
  tracks: 'tracks', playlists: 'playlists', likedSongs: 'Liked songs',
  mixesEmpty: 'Listen to a few tracks to create your Mixes.', forYouEmpty: 'Listen to a few tracks and this row will follow your taste.',
  basedOn: 'based on ', mix: 'Mix', dailyMix: 'Daily mix', addAccountTitle: 'Add account',
  oneAccount: 'One account per person, each with their own playlists and history.',
  noSession: 'Sign in to find your music.', error: 'Error.', loading: 'Loading…',
  tracksCount: 'tracks', playlistTracks: 'tracks', remove: 'Remove', delete: 'Delete',
  accountPlaylists: 'playlists', searchSongs: 'Songs', noDownloadsHint: 'Download a track from the player.',
  sessionExpired: 'Session expired, sign in again.', createPlaylistTitle: 'New playlist',
  addToPlaylistEmpty: 'Create a playlist to save this track.', settings: 'Settings',
  edit: 'Edit', cancel: 'Cancel', confirm: 'Confirm', noPlaylistsHint: 'Create your first playlist.',
  liked: 'Favorite', unliked: 'Removed from favorites', nowPlaying: 'Now playing',
}

const es: Dict = {
  listen: 'Escuchar', search: 'Buscar', library: 'Biblioteca',
  yourMixes: 'Tus Mix', forYou: 'Para ti', recent: 'Escuchado hace poco',
  exploreMoods: 'Explora por gusto', yourPlaylists: 'Tus listas', seeAll: 'Ver todo',
  signInTitle: 'Tus listas, aquí', signInBody: 'Inicia sesión con tu cuenta Sonora para recuperar tus listas.',
  signIn: 'Iniciar sesión', createAccount: 'Crear una cuenta', logout: 'Cerrar sesión',
  username: 'Usuario', password: 'Contraseña', fillFields: 'Rellena los dos campos.',
  loggingIn: 'Conectando…', addAccount: 'Añadir cuenta', language: 'Idioma', version: 'Versión',
  favorites: 'Favoritos', downloads: 'Descargas', myPlaylists: 'Mis listas',
  noFavorites: 'Aún no hay favoritos.', noDownloads: 'Ninguna descarga.', noPlaylists: 'Ninguna lista.',
  searchTitle: 'Buscar', searchSubtitle: 'Todo YouTube Music, en un gesto.',
  searchPlaceholder: 'Artistas, canciones, álbumes…', searchHint: 'Busca un artista, una canción, un ambiente.',
  noResults: 'Sin resultados.', all: 'Canciones', videos: 'Vídeos', albums: 'Álbumes', artists: 'Artistas',
  loadMore: 'Cargar más', queue: 'Cola', addToPlaylist: 'Añadir a una lista',
  newPlaylist: 'Nueva lista…', create: 'Crear', play: 'Reproducir', pause: 'Pausa',
  shuffle: 'Aleatorio', repeat: 'Repetir', close: 'Cerrar', volume: 'Volumen',
  download: 'Descargar', downloaded: 'Descargado ✓', unavailable: 'No se puede reproducir',
  tracks: 'canciones', playlists: 'listas', likedSongs: 'Canciones que te gustan',
  mixesEmpty: 'Escucha algunos títulos para crear tus Mix.', forYouEmpty: 'Escucha algunos títulos y esta fila seguirá tus gustos.',
  basedOn: 'según ', mix: 'Mix', dailyMix: 'Mix diario', addAccountTitle: 'Añadir cuenta',
  oneAccount: 'Una cuenta por persona, cada uno con sus listas e historial.',
  noSession: 'Inicia sesión para encontrar tu música.', error: 'Error.', loading: 'Cargando…',
  tracksCount: 'canciones', playlistTracks: 'canciones', remove: 'Quitar', delete: 'Eliminar',
  accountPlaylists: 'listas', searchSongs: 'Canciones', noDownloadsHint: 'Descarga un título desde el reproductor.',
  sessionExpired: 'Sesión caducada, vuelve a iniciar sesión.', createPlaylistTitle: 'Nueva lista',
  addToPlaylistEmpty: 'Crea una lista para guardar este título.', settings: 'Ajustes',
  edit: 'Editar', cancel: 'Cancelar', confirm: 'Confirmar', noPlaylistsHint: 'Crea tu primera lista.',
  liked: 'Favorito', unliked: 'Quitado de favoritos', nowPlaying: 'Reproduciendo',
}

const DICTS: Record<Lang, Dict> = { fr, en, es }

export function tr(lang: Lang, key: string): string {
  return DICTS[lang]?.[key] ?? DICTS.en[key] ?? key
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
