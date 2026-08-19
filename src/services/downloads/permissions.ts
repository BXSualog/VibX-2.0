import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { StorageAccessFramework } from 'expo-file-system/legacy';

const ACCESS_FILE = 'downloads-folder-access.json';

function accessFile() {
  return new File(Paths.document, ACCESS_FILE);
}

export async function getDownloadsFolderUri(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  try {
    const file = accessFile();
    if (!file.exists) return null;
    const data = (await file.json()) as { uri?: string };
    return data?.uri ?? null;
  } catch {
    return null;
  }
}

export async function hasDownloadsFolderAccess(): Promise<boolean> {
  return Boolean(await getDownloadsFolderUri());
}

function saveDownloadsFolderUri(uri: string) {
  const file = accessFile();
  if (!file.exists) file.create();
  file.write(JSON.stringify({ uri }));
}

export async function requestDownloadsFolderAccess(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    try {
      const initial = StorageAccessFramework.getUriForDirectoryInRoot('Download');
      const result = await StorageAccessFramework.requestDirectoryPermissionsAsync(initial);
      if (result.granted) {
        saveDownloadsFolderUri(result.directoryUri);
        return result.directoryUri;
      }
    } catch {
      // Fall through to the generic folder picker.
    }
  }

  try {
    const initial =
      Platform.OS === 'android'
        ? StorageAccessFramework.getUriForDirectoryInRoot('Download')
        : undefined;
    const directory = await Directory.pickDirectoryAsync(initial);
    if (directory?.uri) {
      saveDownloadsFolderUri(directory.uri);
      return directory.uri;
    }
  } catch {
    return getDownloadsFolderUri();
  }

  return null;
}

export async function ensureDownloadsFolderAccess(): Promise<string | null> {
  return (await getDownloadsFolderUri()) ?? requestDownloadsFolderAccess();
}
