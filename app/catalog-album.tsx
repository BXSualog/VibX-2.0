import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CatalogCollectionScreen } from '@/src/components/CatalogCollectionScreen';
import { fetchAlbumCollection } from '@/src/services/catalog/deezer';

export default function CatalogAlbumRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const albumId = Number(id);
  const load = useCallback(() => fetchAlbumCollection(albumId), [albumId]);
  return <CatalogCollectionScreen kind="album" load={load} />;
}
