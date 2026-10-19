/**
 * I GLOBALI del gioco: ogni file carica per `<script>` e si pubblica su
 * `window` (non ci sono moduli). Qui sono dichiarati come `any` così i file
 * con `// @ts-check` possono nominarli senza errore. È un ELENCO DI NOMI, non
 * di forme: quando un componente ha un contratto stabile conviene descriverlo
 * in un file di tipi suo (come types/motore.d.ts) e togliere la riga da qui.
 *
 * Una riga si aggiunge quando un file che accendi con `// @ts-check` usa un
 * globale che il controllo non conosce (l'errore dice `Cannot find name` o
 * `Property ... does not exist on type 'Window'`).
 */
declare var __authGatePending: any;
declare var __pageLoaderStart: any;
declare var AI_DEBUG: any;
declare var AI_HARD: any;
declare var AI_MEDIUM: any;
declare var ArenaOptions: any;
declare var AudioLibrary: any;
declare var AUTH_GATE_SKIP: any;
declare var AutoSync: any;
declare var BotSpeed: any;
declare var Capacitor: any;
declare var CARD_ORIGIN_EXCEPTIONS: any;
declare var CardDropAnimation: any;
declare var CardRarity: any;
declare var CartaViva: any;
declare var ChallengeBanner: any;
declare var CharacterUnlocks: any;
declare var chiavePersonaggio: any;
declare var createCardElement: any;
declare var CustomCards: any;
declare var DeckBox: any;
declare var DeckLegality: any;
declare var DeckSwitcher: any;
declare var DuelNetwork: any;
declare var DuelSFX: any;
declare var EventiDuello: any;
declare var GRIDI_EVOCAZIONE: any;
declare var HologramSetting: any;
declare var Howl: any;
declare var Icons: any;
declare var Inclinazione: any;
declare var ModeUnlocks: any;
declare var MP_ricezioneEsito: any;
declare var NativeBackButton: any;
declare var NativeHaptics: any;
declare var NativeKeepAwake: any;
declare var NativeSaveBackup: any;
declare var PAGE_LOADER_MANUAL_HIDE: any;
declare var PAGE_LOADER_SKIP: any;
declare var PageLoader: any;
declare var PageTopbar: any;
declare var ProfileHero: any;
declare var ProfileStats: any;
declare var ProtocolloMP: any;
declare var Rewards: any;
declare var SFX: any;
declare var StoryAdminTools: any;
declare var storyCampaignsDatabase: any;
declare var StoryRitocchi: any;
declare var storyRitocchi: any;
declare var SUPABASE_CONFIG: any;
declare var TintaCampo: any;
declare var TINTE_CAMPI: any;
declare var trovaGridoEvocazione: any;
declare var VideoQuality: any;
declare var AmbienteWebGL: any;
declare var VisualEffects: any;
