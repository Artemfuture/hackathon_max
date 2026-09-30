import photoExhibition from '../assets/photo-exhibition.webp';
import photoWalk from '../assets/photo-walk.webp';
import photoConcert from '../assets/photo-concert.webp';
import coverBar from '../assets/covers/bar.svg';
import coverCafe from '../assets/covers/cafe.svg';
import coverCinema from '../assets/covers/cinema.svg';
import coverCity from '../assets/covers/city.svg';
import coverCraft from '../assets/covers/craft.svg';
import coverGames from '../assets/covers/games.svg';
import coverMuseum from '../assets/covers/museum.svg';
import coverPark from '../assets/covers/park.svg';
import coverShow from '../assets/covers/show.svg';
import coverSkating from '../assets/covers/skating.svg';
import coverSport from '../assets/covers/sport.svg';
import coverSwimming from '../assets/covers/swimming.svg';
import coverTalk from '../assets/covers/talk.svg';
import coverTheatre from '../assets/covers/theatre.svg';

export const PHOTOS = {
  exhibition: photoExhibition,
  walk: photoWalk,
  concert: photoConcert,
  bar: coverBar,
  cafe: coverCafe,
  cinema: coverCinema,
  city: coverCity,
  craft: coverCraft,
  games: coverGames,
  museum: coverMuseum,
  park: coverPark,
  show: coverShow,
  sport: coverSport,
  skating: coverSkating,
  swimming: coverSwimming,
  talk: coverTalk,
  masterclass: coverCraft,
  food: coverCafe,
  theatre: coverTheatre,
};

export const FALLBACK_PHOTO = 'city';
