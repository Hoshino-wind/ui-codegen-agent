import assert from "node:assert/strict";
import test from "node:test";

import { createIntakeWorkspaceFromImageFile } from "../dist/app/imageFileIntake.js";

test("createIntakeWorkspaceFromImageFile creates intake state from a PNG file and decoded dimensions", async () => {
  const file = { name: "landing-page.png", type: "image/png", size: 1024 };
  const intake = await createIntakeWorkspaceFromImageFile(file, {
    readImageDimensions: async (received) => {
      assert.equal(received.name, "landing-page.png");
      return { width: 1536, height: 2048 };
    }
  });

  assert.equal(intake.sourceImage.uri, "landing-page.png");
  assert.equal(intake.sourceImage.width, 1536);
  assert.equal(intake.sourceImage.height, 2048);
  assert.equal(intake.analysisPlan.sections.length, 8);
  assert.equal(intake.selectedSectionId, "hero");
});

test("createIntakeWorkspaceFromImageFile rejects non-PNG image files before reading dimensions", async () => {
  let readCalled = false;

  await assert.rejects(
    () =>
      createIntakeWorkspaceFromImageFile(
        { name: "landing-page.jpg", type: "image/jpeg", size: 2048 },
        {
          readImageDimensions: async () => {
            readCalled = true;
            return { width: 1536, height: 2048 };
          }
        }
      ),
    /Only PNG files are supported/
  );
  assert.equal(readCalled, false);
});
