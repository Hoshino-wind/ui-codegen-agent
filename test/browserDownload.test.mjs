import assert from "node:assert/strict";
import test from "node:test";

import { triggerBrowserDownload } from "../dist/app/browserDownload.js";

test("triggerBrowserDownload appends the anchor before clicking binary artifacts", () => {
  const events = [];
  const anchor = {
    href: "",
    download: "",
    click() {
      events.push("click");
      assert.equal(events.includes("append"), true);
    },
    remove() {
      events.push("remove");
    }
  };
  const document = {
    body: {
      append(node) {
        assert.equal(node, anchor);
        events.push("append");
      }
    },
    createElement(tagName) {
      assert.equal(tagName, "a");
      return anchor;
    }
  };
  const url = {
    createObjectURL(blob) {
      assert.equal(blob.type, "application/zip");
      assert.equal(blob.size, 4);
      events.push("createObjectURL");
      return "blob:project";
    },
    revokeObjectURL(value) {
      assert.equal(value, "blob:project");
      events.push("revokeObjectURL");
    }
  };

  const result = triggerBrowserDownload(
    {
      fileName: "project.zip",
      mimeType: "application/zip",
      contents: new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    },
    { document, url }
  );

  assert.deepEqual(events, ["createObjectURL", "append", "click", "remove", "revokeObjectURL"]);
  assert.equal(anchor.download, "project.zip");
  assert.equal(anchor.href, "blob:project");
  assert.deepEqual(result, { fileName: "project.zip", mimeType: "application/zip", size: 4 });
});
