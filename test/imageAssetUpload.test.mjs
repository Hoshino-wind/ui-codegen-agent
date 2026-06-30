import assert from "node:assert/strict";
import test from "node:test";

import { createImageAssetPatchFromFile } from "../dist/app/imageAssetUpload.js";

test("createImageAssetPatchFromFile converts an uploaded image file into an asset patch", async () => {
  const patch = await createImageAssetPatchFromFile(
    {
      name: "hero.png",
      type: "image/png"
    },
    {
      readAsDataUrl: async (file) => `data:${file.type};base64,aGVybw==`
    }
  );

  assert.equal(patch.source, "uploaded");
  assert.equal(patch.uri, "data:image/png;base64,aGVybw==");
});

test("createImageAssetPatchFromFile rejects non-image uploads", async () => {
  await assert.rejects(
    () =>
      createImageAssetPatchFromFile(
        {
          name: "notes.txt",
          type: "text/plain"
        },
        {
          readAsDataUrl: async () => "data:text/plain;base64,bm90ZXM="
        }
      ),
    /Image replacement must be an image file/
  );
});

test("createImageAssetPatchFromFile rejects readers that return non-image data URIs", async () => {
  await assert.rejects(
    () =>
      createImageAssetPatchFromFile(
        {
          name: "hero.png",
          type: "image/png"
        },
        {
          readAsDataUrl: async () => "data:text/plain;base64,bm90ZXM="
        }
      ),
    /reader must return an image data URI/
  );
});
