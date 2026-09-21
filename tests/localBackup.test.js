import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLocalBackupFilename,
  saveLocalBackup,
  serializeLocalBackup,
} from "../src/utils/localBackup.js";

test("local backup filename and JSON are deterministic", () => {
  assert.equal(
    buildLocalBackupFilename("2026-09-21"),
    "maza-hishob-backup-2026-09-21.json"
  );
  assert.deepEqual(JSON.parse(serializeLocalBackup({ app: "Maza Hishob" })), {
    app: "Maza Hishob",
  });
});

test("browser backup clicks a mounted download and revokes it after the click", async () => {
  const events = [];
  const anchor = {
    style: {},
    click: () => events.push("click"),
    remove: () => events.push("remove"),
  };
  const documentObject = {
    body: {
      appendChild: (element) => {
        assert.equal(element, anchor);
        events.push("append");
      },
    },
    createElement: (tagName) => {
      assert.equal(tagName, "a");
      return anchor;
    },
  };
  const urlApi = {
    createObjectURL: () => "blob:backup",
    revokeObjectURL: (url) => events.push(`revoke:${url}`),
  };

  const result = await saveLocalBackup({
    data: { app: "Maza Hishob" },
    dateValue: "2026-09-21",
    isNative: false,
    documentObject,
    urlApi,
    BlobCtor: Blob,
    scheduleCleanup: (callback, delay) => {
      assert.equal(delay, 1000);
      callback();
    },
  });

  assert.equal(anchor.download, "maza-hishob-backup-2026-09-21.json");
  assert.equal(anchor.href, "blob:backup");
  assert.deepEqual(events, ["append", "click", "remove", "revoke:blob:backup"]);
  assert.equal(result.destination, "download");
});

test("native backup writes UTF-8 JSON and opens the Android share sheet", async () => {
  let writeOptions;
  let shareOptions;
  const result = await saveLocalBackup({
    data: { schemaVersion: 3, expenses: [] },
    dateValue: "2026-09-21",
    isNative: true,
    filesystem: {
      writeFile: async (options) => {
        writeOptions = options;
        return { uri: "file:///cache/backups/maza-hishob-backup.json" };
      },
    },
    share: {
      share: async (options) => {
        shareOptions = options;
      },
    },
  });

  assert.equal(writeOptions.path, "backups/maza-hishob-backup-2026-09-21.json");
  assert.equal(writeOptions.recursive, true);
  assert.deepEqual(JSON.parse(writeOptions.data), {
    schemaVersion: 3,
    expenses: [],
  });
  assert.deepEqual(shareOptions.files, [writeOptions ? "file:///cache/backups/maza-hishob-backup.json" : ""]);
  assert.equal(result.destination, "share");
});
