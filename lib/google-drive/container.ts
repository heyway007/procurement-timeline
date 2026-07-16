import { assertGoogleDriveEnv } from "@/lib/storage/config";
import {
  GoogleDriveApiFileClient,
  GoogleDriveDataStore,
} from "./datastore";

let store: GoogleDriveDataStore | undefined;

export function getGoogleDriveDataStore(): GoogleDriveDataStore {
  if (!store) {
    const config = assertGoogleDriveEnv(process.env);
    store = new GoogleDriveDataStore(
      GoogleDriveApiFileClient.fromConfig(config),
    );
  }
  return store;
}
