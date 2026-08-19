import { artistMatchKey, FILIPINO_ARTISTS } from '@/src/utils/knownArtists';

const FILIPINO_ARTIST_KEYS = new Set(FILIPINO_ARTISTS.map((name) => artistMatchKey(name)));

const FILIPINO_HINT =
  /\b(ako|akin|araw|ba|bakit|dahil|di|ewan|gabi|hindi|huling|huwag|ibigin|ikaw|iyak|ka|kalimutan|kapag|kita|ko|kung|kupido|lagi|laging|luha|mahal|magmahal|mga|mo|na|nga|ngayon|pa|pagdating|pagibig|pangarap|parin|pasulyap|puso|rin|sa|sabihin|sakay|sinta|sining|tapat|takot|umiiyak)\b/i;

export function normalizeCoverTitle(value: string): string {
  return value
    .replace(/\bi ve\b/gi, "I've")
    .replace(/\bi m\b/gi, "I'm")
    .replace(/\bi ll\b/gi, "I'll")
    .replace(/\bi d\b/gi, "I'd")
    .replace(/\bdon t\b/gi, "don't")
    .replace(/\bcan t\b/gi, "can't")
    .replace(/\bwont\b/gi, "won't")
    .replace(/\bit s\b/gi, "it's")
    .replace(/\byou re\b/gi, "you're")
    .replace(/\s+/g, ' ')
    .trim();
}

export function coverTitleKey(value: string): string {
  return normalizeCoverTitle(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/ñ/g, 'n')
    .replace(/['’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function looksFilipinoTitle(title: string): boolean {
  return FILIPINO_HINT.test(title);
}

export function isKnownFilipinoArtist(artist: string): boolean {
  const key = artistMatchKey(artist);
  return Boolean(key) && FILIPINO_ARTIST_KEYS.has(key);
}

export function isCoverChannel(value?: string): boolean {
  return /\b(covers?|karaoke|tribute|backing tracks?|instrumentals?|heart ballads?|rock versions?|ai rock|pinoy hits)\b/i.test(
    value ?? '',
  );
}

const TITLE_ALIASES: Record<string, string> = {
  icantfightthisfeeling: 'cantfightthisfeeling',
  illneverletyougo: 'neverletyougo',
  neverletgo: 'neverletyougo',
  fromthismomenton: 'fromthismoment',
  sendmethepillowyoudreamon: 'sendmethepillow',
};

const COVER_ORIGINALS: Record<string, string[]> = {
  'allornothing': ['O-Town', 'Westlife'],
  'thisipromiseyou': ['NSYNC', '*NSYNC', 'N Sync'],
  'heavenknows': ['Rick Price'],
  'atthebeginning': ['Donna Lewis', 'Richard Marx'],
  'nothingsgonnastopusnow': ['Starship'],
  'dreamingofyou': ['Selena'],
  'fromthismoment': ['Shania Twain'],
  'ifeveryoureinmyarmsagain': ['Peabo Bryson'],
  'crazylittlethingcalledlove': ['Queen'],
  'letmebethere': ['Olivia Newton-John'],
  'sendmethepillow': ['Johnny Tillotson'],
  'missyoulikecrazy': ['Natalie Cole'],
  'itmightbeyou': ['Stephen Bishop'],
  'youretheinspiration': ['Chicago'],
  'collide': ['Howie Day'],
  'maybe': ['Neocolours'],
  'baliwnapuso': ['Jessa Zaragoza'],
  'bakitngayonkalang': ['Agot Isidro'],
  'marilag': ['Dilaw'],
  'ipagpatawadmo': ['VST & Company'],
  'arawgabi': ['Regine Velasquez'],
  'saakingpuso': ['Jessa Zaragoza'],
  'bakitngabamahalkita': ['Jaya'],
  'missnamisskita': ['The Boyfriends'],
  'mahalkasaakin': ['Jessa Zaragoza'],
  'pasulyapsulyap': ['Jolina Magdangal'],
  'bakitditotohanin': ['Jolina Magdangal'],
  '1251': ['Krissy & Ericka'],
  'alwaysrememberusthisway': ['Lady Gaga'],
  'imwithyou': ['Avril Lavigne'],
  'ivebeenwaitingforyou': ['Guys Next Door'],
  'nextinline': ['Afterimage'],
  'mahalparinkita': ['Rockstar'],
  'becauseofyou': ['Kelly Clarkson'],
  'nothingsgonnachangemyloveforyou': ['Glenn Medeiros', 'George Benson'],
  'listentoyourheart': ['Roxette'],
  'myheartwillgoon': ['Celine Dion'],
  'howdoilive': ['LeAnn Rimes'],
  'illnevergetoveryougettingoverme': ['Expose'],
  'cantfightthisfeeling': ['REO Speedwagon'],
  'iknewyouweretrouble': ['Taylor Swift'],
  'yourguardianangel': ['The Red Jumpsuit Apparatus'],
  'realize': ['Colbie Caillat'],
  'valentine': ['Martina McBride', 'Jim Brickman'],
  'closeryouandi': ['Gino Padilla'],
  'tellme': ['Joey Albert'],
  'kapagtumibokangpuso': ['Donna Cruz'],
  'mrkupido': ['Rachel Alejandro'],
  'kalimutanka': ['Jaya'],
  'crazylove': ['Van Morrison'],
  'neverletyougo': ['Third Eye Blind', 'Steelheart'],
  'nevermind': ['Dennis Lloyd'],
  'myvalentine': ['Paul McCartney'],
  'paperhearts': ['Tori Kelly'],
  'inthestars': ['Benson Boone'],
  'wideawake': ['Katy Perry'],
  'indaclub': ['50 Cent'],
  'thebest': ['Tina Turner'],
  'dahilmahalnamahalkita': ['Roselle Nava'],
  'umiiyakangpusoko': ['April Boy Regino'],
  'pagdatingngpanahon': ['Aiza Seguerra'],
  'lagingtapat': ['Jona'],
  'ewan': ['Imago'],
  'beforeiletyougo': ['Freestyle'],
  'pahina': ['Cup of Joe'],
  'sining': ['Dionela'],
  'hulingsakay': ['Cup of Joe'],
  'pangarapkoangibiginka': ['Regine Velasquez'],
  'kundiman': ['Silent Sanctuary'],
  'hindinaikaw': ['Jona'],
  'iloveyou': ['Celine Dion', 'The Company'],
};

export function originalArtistsForCoverTitle(title: string): string[] {
  const key = coverTitleKey(title);
  if (!key) return [];
  const aliased = TITLE_ALIASES[key] ?? key;
  return COVER_ORIGINALS[key] ?? COVER_ORIGINALS[aliased] ?? [];
}
