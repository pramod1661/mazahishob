import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";

const BACKUP_MIME_TYPE = "application/json";

export const buildLocalBackupFilename = (dateValue) => {
  const safeDate = String(dateValue || "")
    .slice(0, 10)
    .replace(/[^0-9-]/g, "");

  return `maza-hishob-backup-${safeDate || "latest"}.json`;
};

export const serializeLocalBackup = (data) =>
  JSON.stringify(data, null, 2);

export const saveLocalBackup = async ({
  data,
  dateValue,
  isNative = Capacitor.isNativePlatform(),
  filesystem = Filesystem,
  share = Share,
  documentObject = globalThis.document,
  urlApi = globalThis.URL,
  BlobCtor = globalThis.Blob,
  scheduleCleanup = globalThis.setTimeout,
}) => {
  const filename = buildLocalBackupFilename(dateValue);
  const content = serializeLocalBackup(data);

  if (isNative) {
    const savedFile = await filesystem.writeFile({
      path: `backups/${filename}`,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      recursive: true,
    });

    await share.share({
      title: "Maza Hishob local backup",
      text: "Save this backup in a safe location.",
      files: [savedFile.uri],
      dialogTitle: "Save or share backup",
    });

    return {
      filename,
      destination: "share",
      uri: savedFile.uri,
    };
  }

  if (!documentObject?.body || !urlApi?.createObjectURL || !BlobCtor) {
    throw new Error("File download is not supported on this device.");
  }

  const blob = new BlobCtor([content], {
    type: `${BACKUP_MIME_TYPE};charset=utf-8`,
  });
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentObject.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.style.display = "none";
  documentObject.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    scheduleCleanup(() => urlApi.revokeObjectURL(objectUrl), 1000);
  }

  return { filename, destination: "download" };
};
