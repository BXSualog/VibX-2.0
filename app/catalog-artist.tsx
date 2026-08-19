import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CatalogCollectionScreen } from '@/src/components/CatalogCollectionScreen';
import { fetchArtistCollection } from '@/src/services/catalog/deezer';

export default function CatalogArtistRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const artistId = Number(id);
  const load = useCallback(() => fetchArtistCollection(artistId), [artistId]);
  return <CatalogCollectionScreen kind="artist" load={load} />;
}
